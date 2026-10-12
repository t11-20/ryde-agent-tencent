import express from 'express';
import { randomUUID } from 'node:crypto';
import { RunSchema, ActivityEventSchema, StartRunSchema, type Run, type ActivityEvent, type Dispute } from '@fairtrip/contracts';
import { runWorkflow, EXECUTION_LIMITS, mockEvidenceStore, mockPolicyStore, type ModelAdapter, type WorkflowEventEmitter, type WorkflowRoles, type DisputeSource } from '@fairtrip/agents';
import { buildFinalAction, createMockCalculationProvider } from '@fairtrip/agents';
import { catalog, fixtures, examplesFor } from './catalog.js';
import { readConfig, type Config } from './config.js';
import { createModelAdapter } from './model.js';
import { createLiveRoles } from './live-roles.js';

export function createApp(config: Config = readConfig(), modelAdapter?: ModelAdapter, source?: DisputeSource) {
  const app = express();
  const runs = new Map<string, Run>();
  app.disable('x-powered-by');
  app.use(express.json({limit: '64kb'}));

  const mode = config.RUN_MODE;
  const contractVersion = '0.2.0';
  // Lane B fixtures are used only in live mode; stub mode keeps Lane A's contract examples.
  const liveSource = mode === 'live' ? source : undefined;

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    mode,
    contractVersion,
    modelAccess: mode === 'live' ? 'configured' : 'pending_partner_configuration'
  }));

  app.get('/api/fixtures', (_req, res) => {
    if (liveSource) res.json({mode, notice: liveSource.notice, fixtures: liveSource.listFixtures()});
    else res.json({mode, notice: catalog.notice, fixtures});
  });

  app.post('/api/runs', (req, res) => {
    const input = StartRunSchema.safeParse(req.body);
    if (!input.success) {res.status(400).json({error: {code: 'INVALID_INPUT', message: 'Expected fixtureId and optional nonempty riderClaim'}}); return;}
    const fixture: Dispute | undefined = liveSource ? liveSource.getDispute(input.data.fixtureId) : catalog.disputes.find(f => f.id === input.data.fixtureId);
    if (!fixture) {res.status(404).json({error: {code: 'UNKNOWN_FIXTURE', message: 'Fixture not found'}}); return;}
    const id = randomUUID();
    const dispute = {...fixture, riderClaim: input.data.riderClaim ?? fixture.riderClaim};
    const events: ActivityEvent[] = [];
    const cases: Run['cases'] = [];
    const retrievedEvidence: Run['retrievedEvidence'] = [];
    const retrievedPolicies: Run['retrievedPolicies'] = [];
    const emit = (actor: ActivityEvent['actor'], type: ActivityEvent['type'], summary: string, evidenceIds: string[] = [], policyClauseIds: string[] = []) => {
      events.push(ActivityEventSchema.parse({runId: id, sequence: events.length + 1, timestamp: new Date().toISOString(), mode, actor, type, summary, evidenceIds, policyClauseIds}));
    };
    emit('system', 'run.started', mode === 'stub' ? 'Development stub started; no model invocation or evidence retrieval.' : 'Live run started; model invocation and evidence retrieval will follow.');
    const base = {id, fixtureId: input.data.fixtureId, mode: mode as Run['mode'], dispute, cases, events, retrievedEvidence, retrievedPolicies};
    runs.set(id, RunSchema.parse({...base, status: 'queued'}));

    setImmediate(() => {
      let terminal = false;
      const deadlineController = new AbortController();
      const fail = (message: string) => {
        if (terminal) return;
        emit('system', 'run.failed', `Workflow failed: ${message}`);
        terminal = true;
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'failed', error: {code: 'WORKFLOW_FAILED', message}}));
      };
      const deadlineTimeout = setTimeout(() => {
        const error = new Error('Run deadline exceeded (90s)');
        deadlineController.abort(error);
        fail(error.message);
      }, EXECUTION_LIMITS.runDeadlineMs);

      runs.set(id, RunSchema.parse({...base, status: 'running'}));

      const examples = examplesFor(dispute);
      const evidence = liveSource ? liveSource.allEvidence(dispute) : mode === 'live' ? mockEvidenceStore[dispute.id] ?? [] : catalog.evidence;
      const policies = liveSource ? liveSource.policiesFor(dispute.category) : mode === 'live' ? mockPolicyStore[dispute.category] ?? [] : examples.policies;

      // Create event emitter that also prevents late writes after terminal state
      const emitter: WorkflowEventEmitter = {
        emit(event) {
          if (terminal) return; // Prevent late writes after terminal transition
          emit(event.actor, event.type, event.summary, event.evidenceIds ?? [], event.policyClauseIds ?? []);
          try {
            runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'running'}));
          } catch {
            // Ignore validation errors during event emission
          }
        }
      };

      const roles: WorkflowRoles = mode === 'live'
        ? createLiveRoles(modelAdapter ?? createModelAdapter(config), emitter, retrievedEvidence, retrievedPolicies, cases, liveSource ? d => liveSource.createTools(d) : undefined)
        : {
        async advocate(side) {
          const c = examples.cases.find(c => c.side === side);
          if (c) cases.push(c);
          return c;
        },
        async judge() { return examples.modelResponse; }
      };
      void runWorkflow(dispute, roles, evidence, policies, deadlineController.signal, emitter).then(({modelResponse}) => {
        clearTimeout(deadlineTimeout);
        if (terminal) return;
        const missingDecisive = liveSource ? liveSource.missingDecisiveEvidence(dispute) : [];
        if (missingDecisive.length) {
          emit('system', 'run.incomplete', `Decisive evidence unavailable (${missingDecisive.join('; ')}); no ruling or amount issued.`);
          terminal = true;
          runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'incomplete', missingEvidence: missingDecisive}));
          return;
        }
        if (mode === 'live' && modelResponse.ruling === 'incomplete') {
          emit('system', 'run.incomplete', 'Judge requires additional decisive evidence; no monetary action issued.');
          terminal = true;
          const missingEvidence = cases.flatMap(value => value.missingFacts);
          runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'incomplete', missingEvidence: missingEvidence.length ? [...new Set(missingEvidence)] : ['Additional decisive evidence is required by the Judge.']}));
          return;
        }

        // Server constructs FinalAction from the model's remedyId selection
        const calculationProvider = liveSource ? liveSource.calculationProvider(dispute) : createMockCalculationProvider();
        const {action, error} = buildFinalAction(modelResponse, evidence, calculationProvider, dispute.category);

        if (error) {
          emit('system', 'run.incomplete', `Remedy validation failed: ${error.message}`);
          terminal = true;
          runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'incomplete', missingEvidence: [error.message]}));
          return;
        }

        const result = {...modelResponse, action};
        emit('system', 'run.completed', mode === 'stub' ? 'Stub response ready; this is not a real dispute decision.' : liveSource ? 'Live model run completed using SYNTHETIC fixtures, DEMONSTRATION POLICY and deterministic calculations; this is not a real dispute decision.' : 'Live model run completed using synthetic contract examples and mock calculations; this is not a real dispute decision.');
        terminal = true;
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'completed', result}));
      }).catch((err) => {
        clearTimeout(deadlineTimeout);
        fail(err instanceof Error ? err.message : 'Workflow execution failed');
      });
    });
    res.status(202).json({id, mode, status: 'queued'});
  });

  app.get('/api/runs/:id', (req, res) => {
    const after = req.query.after ?? '0';
    if (typeof after !== 'string' || !/^\d+$/.test(after) || !Number.isSafeInteger(Number(after))) {
      res.status(400).json({error: {code: 'INVALID_SEQUENCE', message: 'after must be a nonnegative safe integer'}}); return;
    }
    const run = runs.get(req.params.id);
    if (!run) {res.status(404).json({error: {code: 'UNKNOWN_RUN', message: 'Run not found'}}); return;}
    res.json(RunSchema.parse({...run, events: run.events.filter(e => e.sequence > Number(after))}));
  });

  app.use((_req, res) => res.status(404).json({error: {code: 'NOT_FOUND', message: 'Endpoint not found'}}));
  app.use((error: {status?: number}, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    res.status(status).json({error: {code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST', message: status === 500 ? 'Request failed' : 'Invalid or oversized JSON request'}});
  });
  return app;
}
