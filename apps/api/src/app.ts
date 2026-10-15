import express from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  RunSchema, ActivityEventSchema, StartRunSchema, ReviewRequestSchema, RiskAssessmentSchema,
  type Run, type ActivityEvent, type Dispute, type Escalation, type Evidence, type FinalAction,
  type JudgeModelResponse, type Precedent, type RiskAssessment, type RunDivergence,
} from '@fairtrip/contracts';
import { runWorkflow, EXECUTION_LIMITS, mockEvidenceStore, mockPolicyStore, type ModelAdapter, type WorkflowEventEmitter, type WorkflowRoles, type DisputeSource } from '@fairtrip/agents';
import { buildFinalAction, createMockCalculationProvider } from '@fairtrip/agents';
import { catalog, fixtures, examplesFor } from './catalog.js';
import { readConfig, type Config } from './config.js';
import { createModelAdapter, providerProfile } from './model.js';
import { createLiveRoles } from './live-roles.js';
import { loadReplays, replaySourceName } from './replay.js';
import { finalisationDecision, isRetryableFailure } from './finalisation.js';

// A ruling follows the remedy, not the model's ruling field (which may be 'incomplete').
function rulingFor(remedyId: FinalAction['remedyId']): 'rider_favored' | 'driver_favored' {
  return remedyId === 'keep_charge' ? 'driver_favored' : 'rider_favored';
}

function firstSentence(text: string, max = 200): string {
  const end = /[.!?]/.exec(text);
  const sentence = end === null ? text : text.slice(0, end.index + 1);
  return sentence.slice(0, max);
}

interface RunContext {
  dispute: Dispute;
  evidence: Evidence[];
  modelResponse: JudgeModelResponse;
  features: string[];
}

export function createApp(config: Config = readConfig(), modelAdapter?: ModelAdapter, source?: DisputeSource) {
  const app = express();
  const runs = new Map<string, Run>();
  const createdAt = new Map<string, string>();
  app.disable('x-powered-by');
  app.use(express.json({limit: '64kb'}));

  const mode = config.RUN_MODE;
  const contractVersion = '0.3.3';
  // Lane B fixtures are used in live mode and in replay mode; stub mode keeps Lane A's contract examples.
  const liveSource = (mode === 'live' || mode === 'replay') ? source : undefined;
  const precedentStore: Precedent[] = liveSource ? liveSource.precedentSeed() : [];
  const runContexts = new Map<string, RunContext>();
  // Replay mode loads the recorded eval runs once at startup; no model is involved.
  const replayDir = resolve(config.REPLAY_DIR);
  const replays = mode === 'replay' ? loadReplays(replayDir) : undefined;
  const replaySource = replaySourceName(replayDir);

  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    mode,
    contractVersion,
    modelAccess: mode === 'live' ? 'configured' : mode === 'replay' ? 'not_used_replay' : 'pending_partner_configuration',
    model: {
      provider: providerProfile(config),
      // Generic providers control thinking exclusively via MODEL_EXTRA_BODY.
      thinking: providerProfile(config) === 'minimax' ? config.MODEL_THINKING : 'extra-body',
      serviceTier: config.MODEL_SERVICE_TIER
    },
    ...(replays === undefined ? {} : {replay: {sourceEvalRun: replaySource, speed: config.REPLAY_SPEED, fixtures: replays.size}})
  }));

  app.get('/api/fixtures', (_req, res) => {
    if (liveSource) {
      const listed = replays === undefined ? liveSource.listFixtures() : liveSource.listFixtures().filter(item => replays.has(item.id));
      res.json({mode, notice: liveSource.notice, fixtures: listed});
    }
    else res.json({mode, notice: catalog.notice, fixtures});
  });

  app.get('/api/runs', (_req, res) => {
    const list = [...runs.entries()].reverse().slice(0, 50).map(([runId, run]) => ({
      id: runId,
      fixtureId: run.fixtureId,
      mode: run.mode,
      status: run.status,
      createdAt: createdAt.get(runId) ?? run.events[0]?.timestamp ?? '',
      remedyId: run.status === 'completed' ? run.result.action.remedyId : null,
      amountCents: run.status === 'completed' ? run.result.action.amountCents : null,
      escalated: run.status === 'completed' && run.escalation !== undefined,
      retryOf: run.retryOf ?? null
    }));
    res.json({runs: list});
  });

  // Re-emits a recorded eval run without a model: every recorded event fires at
  // (recorded offset / REPLAY_SPEED) with a fresh runId, timestamp and sequence;
  // evidence, policy, precedents, money and the review endpoint stay real.
  const startReplayRun = (fixtureId: string): {id: string} | null => {
    const entry = replays?.get(fixtureId);
    if (entry === undefined || liveSource === undefined || replays === undefined) return null;
    const recorded = entry.run;
    const id = randomUUID();
    const dispute = recorded.dispute;
    const events: ActivityEvent[] = [];
    const cases: Run['cases'] = [];
    const retrievedEvidence: Run['retrievedEvidence'] = [];
    const retrievedPolicies: Run['retrievedPolicies'] = [];
    const emit = (actor: ActivityEvent['actor'], type: ActivityEvent['type'], summary: string, evidenceIds: string[] = [], policyClauseIds: string[] = []) => {
      events.push(ActivityEventSchema.parse({runId: id, sequence: events.length + 1, timestamp: new Date().toISOString(), mode, actor, type, summary, evidenceIds, policyClauseIds}));
    };
    const features = liveSource.caseFeatures(dispute);
    const verdict = liveSource.policyVerdict(dispute);
    const replay = {sourceRunId: entry.sourceRunId, recordedAt: entry.recordedAt, sourceEvalRun: replaySource, speed: config.REPLAY_SPEED};
    const base = {id, fixtureId, mode: mode as Run['mode'], dispute, cases, events, retrievedEvidence, retrievedPolicies, replay, verdict};
    let currentRisk: RiskAssessment | undefined;
    let currentPrecedents: Precedent[] | undefined;
    const snapshot = (extra: Record<string, unknown>): Run =>
      RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies,
        ...(currentPrecedents === undefined ? {} : {precedents: currentPrecedents}),
        ...(currentRisk === undefined ? {} : {risk: currentRisk}), ...extra});
    createdAt.set(id, new Date().toISOString());
    runs.set(id, snapshot({status: 'queued'}));
    setImmediate(() => {
      runs.set(id, snapshot({status: 'running'}));
      const first = recorded.events[0];
      if (first === undefined) {runs.set(id, snapshot({status: 'failed', error: {code: 'REPLAY_EMPTY', message: 'Recorded run has no events'}})); return;}
      const t0 = Date.parse(first.timestamp);
      let terminal = false;
      for (const recordedEvent of recorded.events) {
        const parsed = Date.parse(recordedEvent.timestamp);
        const offset = Number.isFinite(parsed) ? parsed - t0 : 0;
        setTimeout(() => {
          if (terminal) return;
          emit(recordedEvent.actor, recordedEvent.type, recordedEvent.summary, recordedEvent.evidenceIds, recordedEvent.policyClauseIds);
          if (recordedEvent.type === 'run.started') {
            // The verdict is recomputed from the fixture source, mirroring live order.
            emit('system', 'verdict.computed', `Policy verdict: ${verdict.outcome} (${verdict.clauseIds.join(', ')}) — ${verdict.basis}`, [], verdict.clauseIds);
          }
          if (recordedEvent.type === 'case.completed') {
            const recordedCase = recorded.cases.find(c => c.side === recordedEvent.actor);
            if (recordedCase !== undefined && !cases.some(c => c.side === recordedCase.side)) cases.push(recordedCase);
          } else if (recordedEvent.type === 'risk.assessed' && recorded.risk !== undefined) {
            currentRisk = recorded.risk;
          } else if (recordedEvent.type === 'precedent.retrieved') {
            // Matched against the live store at replay time so a human review
            // during this session still feeds later replays — the loop stays real.
            currentPrecedents = liveSource.similarPrecedents(dispute, precedentStore);
          } else if (recordedEvent.type === 'evidence.retrieved' && retrievedEvidence.length === 0) {
            retrievedEvidence.push(...recorded.retrievedEvidence);
          } else if (recordedEvent.type === 'policy.retrieved' && retrievedPolicies.length === 0) {
            retrievedPolicies.push(...recorded.retrievedPolicies);
          } else if (recordedEvent.type === 'run.completed' && recorded.status === 'completed') {
            terminal = true;
            // Never trust the recorded money: rebuild the action from the live
            // fixture source and reject the replay when the record disagrees.
            const {action: recordedAction, ...recordedResponse} = recorded.result;
            const rebuilt = buildFinalAction(recordedResponse, liveSource.allEvidence(dispute), liveSource.calculationProvider(dispute), dispute.category);
            if (rebuilt.error !== undefined || rebuilt.action.amountCents !== recordedAction.amountCents
              || rebuilt.action.recipient !== recordedAction.recipient || rebuilt.action.remedyId !== recordedAction.remedyId) {
              runs.set(id, snapshot({status: 'failed', error: {code: 'REPLAY_INVALID', message: `Recorded amount ${recordedAction.amountCents} differs from server-computed ${rebuilt.action.amountCents}`}}));
              return;
            }
            // Re-run the finalisation decision against the deterministic verdict so a
            // recorded run that diverges from policy still shows as escalated.
            const decision = finalisationDecision(verdict, recorded.result.action.remedyId, recorded.result.confidence, config.ESCALATION_CONFIDENCE_THRESHOLD, recorded.risk?.overall);
            const reasons: Escalation['reasons'] = [...new Set([...(recorded.escalation?.reasons ?? []), ...decision.reasons])];
            const escalation = reasons.length === 0 ? undefined : {
              reasons, confidence: recorded.result.confidence, threshold: config.ESCALATION_CONFIDENCE_THRESHOLD,
              summary: recorded.escalation?.summary ?? `Escalated for human review (${reasons.join(' and ')}). The recorded ruling and amount are recommendations until a reviewer confirms or overrides them.`,
            };
            // Same invariant as live: no unescalated completed run may diverge from the verdict.
            if (escalation === undefined && recorded.result.action.remedyId !== verdict.outcome) {
              runs.set(id, snapshot({status: 'failed', error: {code: 'VERDICT_INVARIANT', message: `Recorded ruling ${recorded.result.action.remedyId} diverges from policy verdict ${verdict.outcome} without an escalation`}}));
              return;
            }
            try {
              runs.set(id, snapshot({status: 'completed', result: recorded.result, ...(escalation === undefined ? {} : {escalation}), ...(decision.divergence === undefined ? {} : {divergence: decision.divergence})}));
            } catch {
              runs.set(id, snapshot({status: 'failed', error: {code: 'REPLAY_INVALID', message: 'Recorded run could not be replayed'}}));
              return;
            }
            const {action: _action, ...modelResponse} = recorded.result;
            runContexts.set(id, {dispute, evidence: liveSource.allEvidence(dispute), modelResponse, features});
            if (escalation === undefined && features.length > 0) {
              precedentStore.push({
                id: `PREC-RUN-${id.slice(0, 8)}`, category: dispute.category, decidedAt: new Date().toISOString(),
                origin: 'run', ruling: rulingFor(recorded.result.action.remedyId), remedyId: recorded.result.action.remedyId,
                features, summary: `Past run: ${firstSentence(recorded.result.reasoning)}`, runId: id,
              });
            }
            return;
          } else if (recordedEvent.type === 'run.incomplete' && recorded.status === 'incomplete') {
            terminal = true;
            runs.set(id, snapshot({status: 'incomplete', missingEvidence: recorded.missingEvidence}));
            return;
          } else if (recordedEvent.type === 'run.failed') {
            terminal = true;
            runs.set(id, snapshot({status: 'failed', error: {code: 'REPLAY_FAILED', message: 'The recorded run ended in a failed state.'}}));
            return;
          }
          try { runs.set(id, snapshot({status: 'running'})); } catch { /* keep replaying on a mid-run schema edge */ }
        }, Math.max(0, offset / config.REPLAY_SPEED));
      }
    });
    return {id};
  };

  // Starts a live/stub workflow run. Provider-side failures on a first attempt
  // (no retryOf) trigger exactly one automatic re-run linked by retriedBy/retryOf.
  const startLiveRun = (fixtureId: string, fixture: Dispute, riderClaim: string | undefined, retryOf?: string): string => {
    const id = randomUUID();
    const dispute = {...fixture, riderClaim: riderClaim ?? fixture.riderClaim};
    const events: ActivityEvent[] = [];
    const cases: Run['cases'] = [];
    const retrievedEvidence: Run['retrievedEvidence'] = [];
    const retrievedPolicies: Run['retrievedPolicies'] = [];
    const emit = (actor: ActivityEvent['actor'], type: ActivityEvent['type'], summary: string, evidenceIds: string[] = [], policyClauseIds: string[] = []) => {
      events.push(ActivityEventSchema.parse({runId: id, sequence: events.length + 1, timestamp: new Date().toISOString(), mode, actor, type, summary, evidenceIds, policyClauseIds}));
    };
    emit('system', 'run.started', mode === 'stub' ? 'Development stub started; no model invocation or evidence retrieval.' : 'Live run started; model invocation and evidence retrieval will follow.');
    const base = {id, fixtureId, mode: mode as Run['mode'], dispute, cases, events, retrievedEvidence, retrievedPolicies, ...(retryOf === undefined ? {} : {retryOf})};
    const features = liveSource ? liveSource.caseFeatures(dispute) : [];
    const precedents = liveSource ? liveSource.similarPrecedents(dispute, precedentStore) : [];
    const verdict = liveSource ? liveSource.policyVerdict(dispute) : undefined;
    let currentRisk: RiskAssessment | undefined;
    const snapshot = (extra: Record<string, unknown>): Run =>
      RunSchema.parse({...base, cases, events, retrievedEvidence, retrievedPolicies, precedents,
        ...(verdict === undefined ? {} : {verdict}), ...(currentRisk === undefined ? {} : {risk: currentRisk}), ...extra});
    createdAt.set(id, events[0]?.timestamp ?? new Date().toISOString());
    runs.set(id, snapshot({status: 'queued'}));

    setImmediate(() => {
      let terminal = false;
      const deadlineController = new AbortController();
      const fail = (message: string) => {
        if (terminal) return;
        if (isRetryableFailure(message) && retryOf === undefined) {
          const newId = startLiveRun(fixtureId, fixture, riderClaim, id);
          emit('system', 'run.retrying', `Workflow failure (${message}); starting one automatic re-run ${newId}.`);
          emit('system', 'run.failed', `Workflow failed: ${message}`);
          terminal = true;
          runs.set(id, snapshot({status: 'failed', error: {code: 'WORKFLOW_FAILED', message}, retriedBy: newId}));
          return;
        }
        emit('system', 'run.failed', `Workflow failed: ${message}`);
        terminal = true;
        runs.set(id, snapshot({status: 'failed', error: {code: 'WORKFLOW_FAILED', message}}));
      };
      const deadlineTimeout = setTimeout(() => {
        const error = new Error('Run deadline exceeded (90s)');
        deadlineController.abort(error);
        fail(error.message);
      }, EXECUTION_LIMITS.runDeadlineMs);

      runs.set(id, snapshot({status: 'running'}));

      const examples = examplesFor(dispute);
      const evidence = liveSource ? liveSource.allEvidence(dispute) : mode === 'live' ? mockEvidenceStore[dispute.id] ?? [] : catalog.evidence;
      const policies = liveSource ? liveSource.policiesFor(dispute.category) : mode === 'live' ? mockPolicyStore[dispute.category] ?? [] : examples.policies;
      if (verdict !== undefined)
        emit('system', 'verdict.computed', `Policy verdict: ${verdict.outcome} (${verdict.clauseIds.join(', ')}) — ${verdict.basis}`, [], verdict.clauseIds);

      // Create event emitter that also prevents late writes after terminal state
      const emitter: WorkflowEventEmitter = {
        emit(event) {
          if (terminal) return; // Prevent late writes after terminal transition
          emit(event.actor, event.type, event.summary, event.evidenceIds ?? [], event.policyClauseIds ?? []);
          try {
            runs.set(id, snapshot({status: 'running'}));
          } catch {
            // Ignore validation errors during event emission
          }
        }
      };

      const roles: WorkflowRoles = mode === 'live'
        ? createLiveRoles(
            modelAdapter ?? createModelAdapter(config), emitter, retrievedEvidence, retrievedPolicies, cases,
            liveSource ? d => liveSource.createTools(d) : undefined,
            liveSource
              ? d => ({
                  assessment: liveSource.riskAssessment(d),
                  records: liveSource.allEvidence(d).filter(r => r.source === 'history' || r.source === 'chat'),
                })
              : undefined,
            {thinking: config.MODEL_THINKING})
        : {
        async advocate(side) {
          const c = examples.cases.find(c => c.side === side);
          if (c) cases.push(c);
          return c;
        },
        async judge() { return examples.modelResponse; }
      };
      if (roles.risk !== undefined) {
        const riskRole = roles.risk;
        roles.risk = async (d, s) => {
          const value = await riskRole(d, s);
          currentRisk = RiskAssessmentSchema.parse(value);
          return value;
        };
      }
      void runWorkflow(dispute, roles, evidence, policies, deadlineController.signal, emitter, {precedents}).then(({modelResponse, risk}) => {
        clearTimeout(deadlineTimeout);
        if (terminal) return;
        currentRisk = risk ?? currentRisk;
        const missingDecisive = liveSource ? liveSource.missingDecisiveEvidence(dispute) : [];
        if (missingDecisive.length) {
          emit('system', 'run.incomplete', `Decisive evidence unavailable (${missingDecisive.join('; ')}); no ruling or amount issued.`);
          terminal = true;
          runs.set(id, snapshot({status: 'incomplete', missingEvidence: missingDecisive}));
          return;
        }
        // An 'incomplete' verdict must agree with the decisive-evidence guard above —
        // both derive from the same unavailable families. A mismatch cannot be finalised.
        if (verdict !== undefined && verdict.outcome === 'incomplete') {
          fail(`VERDICT_INVARIANT: policy verdict is incomplete but no decisive family is missing`);
          return;
        }
        if (mode === 'live' && modelResponse.ruling === 'incomplete') {
          emit('system', 'run.incomplete', 'Judge requires additional decisive evidence; no monetary action issued.');
          terminal = true;
          const missingEvidence = cases.flatMap(value => value.missingFacts);
          runs.set(id, snapshot({status: 'incomplete', missingEvidence: missingEvidence.length ? [...new Set(missingEvidence)] : ['Additional decisive evidence is required by the Judge.']}));
          return;
        }

        // Server constructs FinalAction from the model's remedyId selection
        const calculationProvider = liveSource ? liveSource.calculationProvider(dispute) : createMockCalculationProvider();
        const {action, error} = buildFinalAction(modelResponse, evidence, calculationProvider, dispute.category);

        if (error) {
          emit('system', 'run.incomplete', `Remedy validation failed: ${error.message}`);
          terminal = true;
          runs.set(id, snapshot({status: 'incomplete', missingEvidence: [error.message]}));
          return;
        }

        const result = {...modelResponse, action};
        // The ruling may never contradict the remedy: it is derived from the
        // remedy the server will act on. Normalise and record the repair.
        if (modelResponse.ruling !== 'incomplete' && modelResponse.ruling !== rulingFor(action.remedyId)) {
          emit('judge', 'output.repair', `Judge ruling ${modelResponse.ruling} contradicted remedy ${action.remedyId}; ruling normalised to follow the remedy.`);
          result.ruling = rulingFor(action.remedyId);
        }

        let escalation: Escalation | undefined;
        let divergence: RunDivergence | undefined;
        if (liveSource) {
          const decision = finalisationDecision(verdict, action.remedyId, modelResponse.confidence, config.ESCALATION_CONFIDENCE_THRESHOLD, currentRisk?.overall);
          divergence = decision.divergence;
          if (decision.reasons.length > 0) {
            const wording = decision.reasons.map(reason => (
              reason === 'low_confidence' ? 'low confidence'
              : reason === 'high_risk' ? 'high risk'
              : reason === 'policy_divergence' ? 'the ruling diverges from the deterministic policy verdict'
              : 'the deterministic policy verdict is undetermined'));
            const riskPart = decision.reasons.includes('high_risk') && currentRisk !== undefined ? `: ${currentRisk.summary}` : '';
            escalation = {
              reasons: decision.reasons, confidence: modelResponse.confidence,
              threshold: config.ESCALATION_CONFIDENCE_THRESHOLD,
              summary: `Escalated for human review (${wording.join(' and ')}${riskPart}). The Judge's ruling and the server-computed amount are recommendations until a reviewer confirms or overrides them.`,
            };
            emit('system', 'run.escalated', escalation.summary);
          } else if (features.length > 0) {
            precedentStore.push({
              id: `PREC-RUN-${id.slice(0, 8)}`,
              category: dispute.category,
              decidedAt: new Date().toISOString(),
              origin: 'run',
              ruling: rulingFor(action.remedyId),
              remedyId: action.remedyId,
              features,
              summary: `Past run: ${firstSentence(modelResponse.reasoning)}`,
              runId: id,
            });
          }
          runContexts.set(id, {dispute, evidence, modelResponse, features});
        }

        // Invariant: a completed run without an escalation must equal the verdict.
        // Defence in depth — nothing is finalised against the demonstration policy.
        if (verdict !== undefined && escalation === undefined && action.remedyId !== verdict.outcome) {
          fail(`VERDICT_INVARIANT: unescalated ruling ${action.remedyId} diverges from the policy verdict ${verdict.outcome}`);
          return;
        }
        emit('system', 'run.completed', mode === 'stub' ? 'Stub response ready; this is not a real dispute decision.' : liveSource ? 'Live model run completed using SYNTHETIC fixtures, DEMONSTRATION POLICY and deterministic calculations; this is not a real dispute decision.' : 'Live model run completed using synthetic contract examples and mock calculations; this is not a real dispute decision.');
        terminal = true;
        runs.set(id, snapshot({status: 'completed', result, ...(escalation === undefined ? {} : {escalation}), ...(divergence === undefined ? {} : {divergence})}));
      }).catch((err) => {
        clearTimeout(deadlineTimeout);
        if (terminal) return;
        const message = err instanceof Error ? err.message : 'Workflow execution failed';
        // The terminal status is predetermined by missing decisive evidence, whatever the model did.
        const missing = liveSource ? liveSource.missingDecisiveEvidence(dispute) : [];
        if (missing.length > 0) {
          emit('system', 'run.incomplete', `Workflow error (${message}); decisive evidence unavailable (${missing.join('; ')}), so no ruling or amount is issued.`);
          terminal = true;
          runs.set(id, snapshot({status: 'incomplete', missingEvidence: missing}));
          return;
        }
        fail(message);
      });
    });
    return id;
  };

  app.post('/api/runs', (req, res) => {
    const input = StartRunSchema.safeParse(req.body);
    if (!input.success) {res.status(400).json({error: {code: 'INVALID_INPUT', message: 'Expected fixtureId and optional nonempty riderClaim'}}); return;}
    if (replays !== undefined) {
      const started = startReplayRun(input.data.fixtureId);
      if (started === null) {res.status(404).json({error: {code: 'UNKNOWN_FIXTURE', message: 'No replay recorded for this fixture'}}); return;}
      res.status(202).json({id: started.id, mode, status: 'queued'});
      return;
    }
    const fixture: Dispute | undefined = liveSource ? liveSource.getDispute(input.data.fixtureId) : catalog.disputes.find(f => f.id === input.data.fixtureId);
    if (!fixture) {res.status(404).json({error: {code: 'UNKNOWN_FIXTURE', message: 'Fixture not found'}}); return;}
    const id = startLiveRun(input.data.fixtureId, fixture, input.data.riderClaim);
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

  app.get('/api/precedents', (_req, res) => {
    res.json({count: precedentStore.length, precedents: precedentStore});
  });

  app.post('/api/runs/:id/review', (req, res) => {
    const body = ReviewRequestSchema.safeParse(req.body);
    if (!body.success) {res.status(400).json({error: {code: 'INVALID_INPUT', message: 'Expected decision (confirmed or overridden), an optional remedyId and an optional note'}}); return;}
    const run = runs.get(req.params.id);
    if (!run) {res.status(404).json({error: {code: 'UNKNOWN_RUN', message: 'Run not found'}}); return;}
    if (run.status !== 'completed') {res.status(409).json({error: {code: 'REVIEW_NOT_ALLOWED', message: 'Only completed runs can be reviewed'}}); return;}
    if (run.escalation === undefined) {res.status(409).json({error: {code: 'REVIEW_NOT_ALLOWED', message: 'This run was not escalated for human review'}}); return;}
    if (run.review !== undefined) {res.status(409).json({error: {code: 'REVIEW_NOT_ALLOWED', message: 'This run was already reviewed'}}); return;}
    const ctx = runContexts.get(run.id);
    if (ctx === undefined || liveSource === undefined) {res.status(409).json({error: {code: 'REVIEW_NOT_ALLOWED', message: 'Review context is unavailable for this run'}}); return;}

    const decidedAt = new Date().toISOString();
    const emitReview = (summary: string) => {
      run.events.push(ActivityEventSchema.parse({
        runId: run.id, sequence: run.events.length + 1, timestamp: decidedAt, mode: run.mode,
        actor: 'system', type: 'review.decided', summary, evidenceIds: [], policyClauseIds: [],
      }));
    };
    const runPrecedent = (origin: Precedent['origin'], remedyId: FinalAction['remedyId'], summary: string): Precedent | null =>
      ctx.features.length === 0 ? null : {
        id: `PREC-RUN-${run.id.slice(0, 8)}`, category: run.dispute.category, decidedAt, origin,
        ruling: rulingFor(remedyId), remedyId, features: ctx.features, summary: summary.slice(0, 200), runId: run.id,
      };

    if (body.data.decision === 'confirmed') {
      const review = {
        decision: 'confirmed' as const, decidedAt, note: body.data.note,
        ruling: rulingFor(run.result.action.remedyId), action: run.result.action,
      };
      const precedent = runPrecedent('run', run.result.action.remedyId, `Past run: ${firstSentence(ctx.modelResponse.reasoning)}`);
      if (precedent !== null) precedentStore.push(precedent);
      emitReview('Human reviewer confirmed the Judge ruling.');
      const updated = RunSchema.parse({...run, review});
      runs.set(run.id, updated);
      res.json(updated);
      return;
    }

    const remedyId = body.data.remedyId;
    if (remedyId === undefined) {res.status(400).json({error: {code: 'INVALID_INPUT', message: 'An override must name the remedy to apply'}}); return;}
    const rebuilt = buildFinalAction(
      {...ctx.modelResponse, remedyId, ruling: rulingFor(remedyId)},
      ctx.evidence, liveSource.calculationProvider(ctx.dispute), ctx.dispute.category,
    );
    if (rebuilt.error !== undefined) {
      res.status(422).json({error: {code: 'REVIEW_REMEDY_INVALID', message: rebuilt.error.message}});
      return;
    }
    const review = {
      decision: 'overridden' as const, decidedAt, note: body.data.note,
      ruling: rulingFor(remedyId), action: rebuilt.action,
    };
    const precedent = runPrecedent('human_override', remedyId, `Human override: ${body.data.note === '' ? 'no note' : body.data.note}`);
    if (precedent !== null) precedentStore.push(precedent);
    emitReview(`Human reviewer overrode ${run.result.action.remedyId} with ${remedyId}.`);
    const updated = RunSchema.parse({...run, review});
    runs.set(run.id, updated);
    res.json(updated);
  });

  app.use((_req, res) => res.status(404).json({error: {code: 'NOT_FOUND', message: 'Endpoint not found'}}));
  app.use((error: {status?: number}, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    res.status(status).json({error: {code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST', message: status === 500 ? 'Request failed' : 'Invalid or oversized JSON request'}});
  });
  return app;
}
