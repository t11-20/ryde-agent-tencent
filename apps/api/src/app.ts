import express from 'express';
import { randomUUID } from 'node:crypto';
import { RunSchema, ActivityEventSchema, StartRunSchema, type Run, type ActivityEvent, type FinalAction } from '@fairtrip/contracts';
import { runWorkflow } from '@fairtrip/agents';
import { catalog, fixtures, examplesFor } from './catalog.js';
import { readConfig, type Config } from './config.js';

export function createApp(config: Config = readConfig()) {
  // The prerequisite API is deliberately a stub; live mode has no production agent runner yet.
  if (config.RUN_MODE !== 'stub') throw new Error('Live dispute execution is not implemented in the setup scaffold; use check:model for connectivity');
  const app = express();
  const runs = new Map<string, Run>();
  app.disable('x-powered-by');
  app.use(express.json({limit: '64kb'}));
  app.get('/api/health', (_req, res) => res.json({status: 'ok', mode: 'stub', contractVersion: '0.2.0', modelAccess: 'pending_partner_configuration'}));
  app.get('/api/fixtures', (_req, res) => res.json({mode: 'stub', notice: catalog.notice, fixtures}));
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
      events.push(ActivityEventSchema.parse({runId: id, sequence: events.length + 1, timestamp: new Date().toISOString(), mode: 'stub', actor, type, summary, evidenceIds, policyClauseIds}));
    };
    emit('system', 'run.started', 'Development stub started; no model invocation or evidence retrieval.');
    const base = {id, fixtureId: fixture.id, mode: 'stub' as const, dispute, cases, events, retrievedEvidence, retrievedPolicies};
    runs.set(id, RunSchema.parse({...base, status: 'queued'}));
    setImmediate(() => {
      runs.set(id, RunSchema.parse({...base, status: 'running'}));
      const examples = examplesFor(dispute);
      const controller = new AbortController();
      void runWorkflow(dispute, {
        async advocate(side) {
          const c = examples.cases.find(c => c.side === side);
          if (c) cases.push(c);
          return c;
        },
        async judge() { return examples.modelResponse; }
      }, catalog.evidence, examples.policies, controller.signal, {
        emit(event) {
          emit(event.actor, event.type, event.summary, event.evidenceIds ?? [], event.policyClauseIds ?? []);
          runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'running'}));
        }
      }).then(({modelResponse}) => {
        // Server constructs FinalAction from the model's remedyId selection
        const action: FinalAction = {
          remedyId: modelResponse.remedyId,
          recipient: modelResponse.remedyId === 'keep_charge' ? 'none' : 'rider',
          currency: 'SGD',
          amountCents: 0,
          recommendation: 'Development stub only. Do not execute any payment action.'
        };
        const result = {...modelResponse, action};
        emit('system', 'run.completed', 'Stub response ready; this is not a real dispute decision.');
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'completed', result}));
      }).catch((err) => {
        emit('system', 'run.failed', `Workflow failed: ${err instanceof Error ? err.message : String(err)}`);
        runs.set(id, RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, status: 'failed', error: {code: 'WORKFLOW_FAILED', message: err instanceof Error ? err.message : 'Workflow execution failed'}}));
      });
    });
    res.status(202).json({id, mode: 'stub', status: 'queued'});
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
