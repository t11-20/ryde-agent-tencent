import express from 'express';
import { randomUUID } from 'node:crypto';
import { RunSchema, ActivityEventSchema, StartRunSchema, type Run, type ActivityEvent } from '@fairtrip/contracts';
import { runWorkflow, type WorkflowEventEmitter } from '@fairtrip/agents';
import { buildFinalAction, createMockCalculationProvider } from '@fairtrip/agents';
import { catalog, fixtures, examplesFor } from './catalog.js';
import { readConfig, type Config } from './config.js';

export function createApp(config: Config = readConfig()) {
  const app = express();
  const runs = new Map<string, Run>();
  app.disable('x-powered-by');
  app.use(express.json({limit: '64kb'}));

  const mode = config.RUN_MODE;
  const contractVersion = '0.2.0';

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    mode,
    contractVersion,
    modelAccess: mode === 'live' ? 'configured' : 'pending_partner_configuration'
  }));

  app.get('/api/fixtures', (_req, res) => res.json({mode, notice: catalog.notice, fixtures}));

  app.post('/api/runs', (req, res) => {
    const input = StartRunSchema.safeParse(req.body);
    if (!input.success) {res.status(400).json({error: {code: 'INVALID_INPUT', message: 'Expected fixtureId and optional nonempty riderClaim'}}); return;}
    const fixture = catalog.disputes.find(f => f.id === input.data.fixtureId);
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
    const base = {id, fixtureId: fixture.id, mode: mode as Run['mode'], dispute, cases, events, retrievedEvidence, retrievedPolicies};
    runs.set(id, RunSchema.parse({...base, status: 'queued'}));

    setImmediate(() => {
      // Run-level 90-second deadline
      const deadlineController = new AbortController();
      const deadlineTimeout = setTimeout(() => deadlineController.abort(new Error('Run deadline exceeded (90s)')), 90000);

      runs.set(id, RunSchema.parse({...base, status: 'running'}));

      const examples = examplesFor(dispute);

      // Create event emitter that also prevents late writes after terminal state
      let terminal = false;
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

      void runWorkflow(dispute, {
        async advocate(side) {
          const c = examples.cases.find(c => c.side === side);
          if (c) cases.push(c);
          return c;
        },
        async judge() { return examples.modelResponse; }
      }, catalog.evidence, examples.policies, deadlineController.signal, emitter).then(({modelResponse}) => {
        clearTimeout(deadlineTimeout);

        // Server constructs FinalAction from the model's remedyId selection
        const calculationProvider = createMockCalculationProvider();
        const {action, error} = buildFinalAction(modelResponse, catalog.evidence, calculationProvider);

        if (error) {
          emit('system', 'run.incomplete', `Remedy validation failed: ${error.message}`);
          terminal = true;
          runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'incomplete', missingEvidence: [error.message]}));
          return;
        }

        const result = {...modelResponse, action};
        emit('system', 'run.completed', mode === 'stub' ? 'Stub response ready; this is not a real dispute decision.' : 'Live run completed with validated result.');
        terminal = true;
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'completed', result}));
      }).catch((err) => {
        clearTimeout(deadlineTimeout);
        if (terminal) return; // Already in terminal state
        emit('system', 'run.failed', `Workflow failed: ${err instanceof Error ? err.message : String(err)}`);
        terminal = true;
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'failed', error: {code: 'WORKFLOW_FAILED', message: err instanceof Error ? err.message : 'Workflow execution failed'}}));
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
