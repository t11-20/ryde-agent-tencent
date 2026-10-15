import { describe, expect, it } from 'vitest';
import { RunSchema } from '@fairtrip/contracts';
import type { Escalation, PolicyVerdict, Precedent, RiskAssessment, Run, RunDivergence } from '@fairtrip/contracts';
import { findFixture, loadDataset } from '@fairtrip/evidence';
import { checkFeedbackPrecedent, classifyFailure, evaluateRun, fixtureFacts, type FixtureFacts } from '../src/checks.js';
import { executeRun, reviewRun, type RawRun } from '../src/client.js';
import { releaseGate } from '../src/gate.js';
import type { RunChecks, RunResult } from '../src/report.js';
import { computeMetrics, renderScorecard } from '../src/scorecard.js';

const dataset = loadDataset();

function completedRun(facts: FixtureFacts, fixtureId: string, extra: {risk?: RiskAssessment; escalation?: Escalation; precedents?: Precedent[]; verdict?: PolicyVerdict | null; divergence?: RunDivergence}): Run {
  const verdict = extra.verdict === null ? undefined : extra.verdict ?? facts.verdict;
  const fixture = findFixture(dataset, fixtureId);
  if (fixture === undefined) throw new Error(`no fixture ${fixtureId}`);
  const remedyId = facts.expected.expectedRemedyId ?? 'keep_charge';
  const amountCents = facts.expected.expectedAmountCents ?? 0;
  return RunSchema.parse({
    id: `eval-${fixtureId}`, fixtureId, mode: 'live', dispute: fixture.dispute,
    cases: (['rider', 'driver'] as const).map(side => ({
      side, summary: `${side} case`, arguments: [], counterevidence: [], requestedRemedyId: 'keep_charge', missingFacts: []
    })),
    events: [{runId: `eval-${fixtureId}`, sequence: 1, timestamp: '2026-01-01T00:00:00.000Z', mode: 'live', actor: 'system', type: 'run.completed', summary: 'done', evidenceIds: [], policyClauseIds: []}],
    retrievedEvidence: [], retrievedPolicies: [],
    ...(extra.risk === undefined ? {} : {risk: extra.risk}),
    ...(extra.precedents === undefined ? {} : {precedents: extra.precedents}),
    status: 'completed',
    result: {
      ruling: facts.expected.expectedRuling ?? 'driver_favored',
      findings: [], remedyId, confidence: 0.9, reasoning: 'reason', riderExplanation: 'rider', driverExplanation: 'driver',
      action: {remedyId, recipient: remedyId === 'keep_charge' ? 'none' : 'rider', currency: 'SGD', amountCents, recommendation: 'action'}
    },
    ...(extra.escalation === undefined ? {} : {escalation: extra.escalation}),
    ...(verdict === undefined ? {} : {verdict}),
    ...(extra.divergence === undefined ? {} : {divergence: extra.divergence})
  });
}

function rawRun(fixtureId: string, run: Run): RawRun {
  return {fixtureId, attempt: 1, runId: run.id, latencyMs: 100, timedOut: false, problem: null, run, retriedFrom: null, firstAttempt: null, wallMs: 100};
}

const escalation = (reasons: Escalation['reasons']): Escalation =>
  ({reasons, confidence: 0.9, threshold: 0.8, summary: 'Escalated for human review.'});

type Actor = 'rider' | 'driver' | 'risk' | 'judge' | 'system';
function event(runId: string, sequence: number, actor: Actor, type: string, timestamp: string) {
  return {runId, sequence, timestamp, mode: 'live' as const, actor, type, summary: `${type}`, evidenceIds: [], policyClauseIds: []};
}

function failedRun(fixtureId: string, message: string, extraEvents: ReturnType<typeof event>[] = []): Run {
  const fixture = findFixture(dataset, fixtureId);
  if (fixture === undefined) throw new Error(`no fixture ${fixtureId}`);
  const id = `eval-${fixtureId}`;
  return RunSchema.parse({
    id, fixtureId, mode: 'live', dispute: fixture.dispute,
    cases: [], retrievedEvidence: [], retrievedPolicies: [],
    events: [...extraEvents, event(id, extraEvents.length + 1, 'system', 'run.failed', '2026-01-01T00:01:00.000Z')],
    status: 'failed', error: {code: 'WORKFLOW_FAILED', message}
  });
}

describe('classifyFailure', () => {
  const checks = allOk();
  const failing = (name: keyof RunChecks): RunChecks => ({...allOk(), [name]: {ok: false, detail: 'bad'}});

  it('maps provider-side timeout messages to provider_timeout', () => {
    expect(classifyFailure(failedRun('R1', 'The operation was aborted due to timeout'), checks)).toBe('provider_timeout');
    expect(classifyFailure(failedRun('R1', 'TimeoutError'), checks)).toBe('provider_timeout');
  });

  it('maps network failures to provider_network', () => {
    expect(classifyFailure(failedRun('R1', 'fetch failed'), checks)).toBe('provider_network');
    expect(classifyFailure(failedRun('R1', 'network unreachable'), checks)).toBe('provider_network');
  });

  it('maps the run deadline to run_deadline', () => {
    expect(classifyFailure(failedRun('R1', 'Run deadline exceeded (90s)'), checks)).toBe('run_deadline');
  });

  it('maps known model-output problems to model_output', () => {
    for (const message of ['unparseable output after repairs', 'Unknown evidence citation: e-x', 'Unknown policy citation: GE-1',
      'exceeded maximum tool rounds', 'failed schema or citation validation', 'wrong side: driver', 'must independently request evidence'])
      expect(classifyFailure(failedRun('R1', message), checks)).toBe('model_output');
  });

  it('maps any other failed run to model_output', () => {
    expect(classifyFailure(failedRun('R1', 'totally unexpected boom'), checks)).toBe('model_output');
  });

  it('maps a completed run with a wrong outcome to outcome_mismatch', () => {
    const run = completedRun(fixtureFacts(dataset, 'R1'), 'R1', {});
    expect(classifyFailure(run, failing('statusMatch'))).toBe('outcome_mismatch');
    expect(classifyFailure(run, failing('remedyMatch'))).toBe('outcome_mismatch');
    expect(classifyFailure(run, failing('amountExact'))).toBe('outcome_mismatch');
  });

  it('maps non-outcome check failures and missing runs to check_failure', () => {
    const run = completedRun(fixtureFacts(dataset, 'R1'), 'R1', {});
    expect(classifyFailure(run, failing('traceComplete'))).toBe('check_failure');
    expect(classifyFailure(run, failing('riskSignalsIntact'))).toBe('check_failure');
    expect(classifyFailure(null, failing('traceComplete'))).toBe('check_failure');
  });
});

describe('evaluateRun — failure class and role latency', () => {
  it('classifies a timed-out run as provider_timeout and keeps the error message in problem', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const result = evaluateRun(rawRun('R1', failedRun('R1', 'The operation was aborted due to timeout')), facts);
    expect(result.passed).toBe(false);
    expect(result.failureClass).toBe('provider_timeout');
    expect(result.problem).toContain('aborted due to timeout');
  });

  it('derives per-role model time from first model.start to last model.finish', () => {
    const id = 'eval-R1';
    const run = failedRun('R1', 'boom', [
      event(id, 1, 'rider', 'model.start', '2026-01-01T00:00:00.000Z'),
      event(id, 2, 'rider', 'model.finish', '2026-01-01T00:00:05.000Z'),
      event(id, 3, 'rider', 'model.start', '2026-01-01T00:00:06.000Z'),
      event(id, 4, 'rider', 'model.finish', '2026-01-01T00:00:10.500Z'),
      event(id, 5, 'judge', 'model.start', '2026-01-01T00:00:20.000Z'),
      event(id, 6, 'judge', 'model.finish', '2026-01-01T00:00:30.200Z')
    ]);
    const result = evaluateRun(rawRun('R1', run), fixtureFacts(dataset, 'R1'));
    expect(result.roleLatencySec.rider).toBe(10.5); // whole tool loop: first start to last finish
    expect(result.roleLatencySec.judge).toBe(10.2);
    expect(result.roleLatencySec.driver).toBeUndefined();
    expect(result.roleLatencySec.risk).toBeUndefined();
  });

  it('measures per-call spans and recovery counters, folded across the first attempt', () => {
    const id = 'eval-R1';
    const ev = (seq: number, actor: Actor, type: string, ts: string, summary?: string) =>
      ({runId: id, sequence: seq, timestamp: ts, mode: 'live' as const, actor, type, summary: summary ?? type, evidenceIds: [], policyClauseIds: []});
    const first = failedRun('R1', 'boom', [
      ev(1, 'rider', 'model.start', '2026-01-01T00:00:00.000Z'),
      ev(2, 'rider', 'tool.requested', '2026-01-01T00:00:02.000Z'),
      ev(3, 'rider', 'model.retry', '2026-01-01T00:00:03.000Z', 'model call retry 1: network error'),
      ev(4, 'rider', 'model.finish', '2026-01-01T00:00:08.000Z')
    ]);
    const run = failedRun('R1', 'boom', [
      ev(1, 'rider', 'model.start', '2026-01-01T00:00:10.000Z'),
      ev(2, 'rider', 'tool.requested', '2026-01-01T00:00:11.000Z'),
      ev(3, 'rider', 'output.normalised', '2026-01-01T00:00:12.000Z', 'rider output normalised without a repair: type set to final_case'),
      ev(4, 'rider', 'model.finish', '2026-01-01T00:00:15.000Z'),
      ev(5, 'judge', 'model.start', '2026-01-01T00:00:16.000Z'),
      ev(6, 'judge', 'model.hedge', '2026-01-01T00:00:36.000Z', 'model call slow (> 20000 ms); hedged request started'),
      ev(7, 'judge', 'model.hedge', '2026-01-01T00:00:40.000Z', 'hedged request answered first'),
      ev(8, 'judge', 'model.finish', '2026-01-01T00:00:41.000Z'),
      ev(9, 'judge', 'output.repair', '2026-01-01T00:00:42.000Z', 'Judge output failed validation (invalid JSON); directed repair 1 requested.')
    ]);
    const raw: RawRun = {...rawRun('R1', run), retriedFrom: 'first', firstAttempt: first};
    const result = evaluateRun(raw, fixtureFacts(dataset, 'R1'));
    expect(result.modelStats.callSec.toolRequest).toEqual([2, 1]);
    expect(result.modelStats.callSec.case).toEqual([6, 4]);
    expect(result.modelStats.callSec.judge).toEqual([25]);
    expect(result.modelStats.callSec.risk).toEqual([]);
    expect(result.modelStats.directedRepairs).toBe(1);
    expect(result.modelStats.normalisations).toBe(1);
    expect(result.modelStats.callRetries).toBe(1);
    expect(result.modelStats.hedgesFired).toBe(1);
    expect(result.modelStats.hedgesWon).toBe(1);
    const metrics = computeMetrics([result]);
    expect(metrics.modelCalls.toolRequest).toEqual({p50: 1.5, p90: 2, max: 2});
    expect(metrics.modelCalls.judge.p50).toBe(25);
    expect(metrics.callRetries).toBe(1);
    expect(metrics.hedgesWon).toBe(1);
  });

  it('classifies a completed run that fails trace checks as check_failure', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {risk: facts.expectedRisk});
    const result = evaluateRun(rawRun('R1', run), facts);
    expect(result.failureClass).toBe('check_failure');
  });
});

describe('evaluateRun — risk and escalation checks', () => {
  it('passes a completed run whose risk matches the deterministic assessment and escalates high risk', () => {
    const facts = fixtureFacts(dataset, 'N2H');
    expect(facts.expectedRisk.overall).toBe('high');
    const run = completedRun(facts, 'N2H', {risk: facts.expectedRisk, escalation: escalation(['high_risk'])});
    const result = evaluateRun(rawRun('N2H', run), facts);
    expect(result.checks.riskSignalsIntact.ok).toBe(true);
    expect(result.checks.contextOnly.ok).toBe(true);
    expect(result.escalated).toBe(true);
    expect(result.riskOverall).toBe('high');
  });

  it('fails riskSignalsIntact when a signal severity differs', () => {
    const facts = fixtureFacts(dataset, 'N2H');
    const tampered: RiskAssessment = structuredClone(facts.expectedRisk);
    const first = tampered.signals[0];
    if (first === undefined) throw new Error('expected at least one signal');
    first.severity = first.severity === 'high' ? 'low' : 'high';
    const run = completedRun(facts, 'N2H', {risk: tampered, escalation: escalation(['high_risk'])});
    const result = evaluateRun(rawRun('N2H', run), facts);
    expect(result.checks.riskSignalsIntact.ok).toBe(false);
    expect(result.checks.riskSignalsIntact.detail).toContain('signals differ');
  });

  it('fails contextOnly when a high-risk run is not escalated', () => {
    const facts = fixtureFacts(dataset, 'N2H');
    const run = completedRun(facts, 'N2H', {risk: facts.expectedRisk});
    const result = evaluateRun(rawRun('N2H', run), facts);
    expect(result.checks.contextOnly.ok).toBe(false);
  });

  it('fails contextOnly when a low-risk run escalates for high risk', () => {
    const facts = fixtureFacts(dataset, 'R1');
    expect(facts.expectedRisk.overall).not.toBe('high');
    const run = completedRun(facts, 'R1', {risk: facts.expectedRisk, escalation: escalation(['high_risk'])});
    expect(evaluateRun(rawRun('R1', run), facts).checks.contextOnly.ok).toBe(false);
  });

  it('keeps contextOnly when a low-risk run escalates only for low confidence', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {risk: facts.expectedRisk, escalation: escalation(['low_confidence'])});
    const result = evaluateRun(rawRun('R1', run), facts);
    expect(result.checks.contextOnly.ok).toBe(true);
    expect(result.checks.remedyMatch.ok).toBe(true);
    expect(result.checks.amountExact.ok).toBe(true);
  });
});

function allOk(): RunChecks {
  const ok = {ok: true, detail: 'ok'};
  return {statusMatch: ok, remedyMatch: ok, amountExact: ok, citationsValid: ok, traceComplete: ok, noReasoningLeak: ok, withinDeadline: ok, riskSignalsIntact: ok, contextOnly: ok, verdictMatch: ok};
}

function completedResult(checks: RunChecks): RunResult {
  return {
    fixtureId: 'R1', attempt: 1, runId: 'run-1', status: 'completed', remedyId: 'refund_route_excess', amountCents: 1,
    latencyMs: 1000, passed: false, checks, decisiveCoverage: null, problem: null, escalated: false, riskOverall: 'low',
    failureClass: 'check_failure', roleLatencySec: {},
    escalationReasons: [], divergent: false, undetermined: false, retried: false, wallMs: 1000,
    modelStats: {callSec: {toolRequest: [], case: [], judge: [], risk: []}, directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0}
  };
}

describe('releaseGate — risk-context-only', () => {
  const conditionOf = (results: RunResult[]) => {
    const found = releaseGate(results).conditions.find(item => item.name === 'risk-context-only');
    if (found === undefined) throw new Error('no risk-context-only condition');
    return found;
  };

  it('fails when a completed run has broken risk signals', () => {
    const broken = completedResult({...allOk(), riskSignalsIntact: {ok: false, detail: 'overall expected high, got low'}});
    const condition = conditionOf([broken]);
    expect(condition.ok).toBe(false);
    expect(condition.detail).toContain('R1 #1: overall expected high, got low');
  });

  it('passes when completed runs keep risk intact and context only', () => {
    expect(conditionOf([completedResult(allOk())]).ok).toBe(true);
  });
});

describe('renderScorecard — risk and escalation', () => {
  it('renders the new columns and metric bullets', () => {
    const run: RunResult = {
      fixtureId: 'N2H', attempt: 1, runId: 'run-1', status: 'completed', remedyId: 'keep_charge', amountCents: 0,
      latencyMs: 1500, passed: true, checks: allOk(), decisiveCoverage: 1, problem: null, escalated: true, riskOverall: 'high',
      failureClass: null, roleLatencySec: {judge: 9.4},
      escalationReasons: ['high_risk'], divergent: false, undetermined: false, retried: false, wallMs: 1500,
      modelStats: {callSec: {toolRequest: [], case: [], judge: [], risk: []}, directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0}
    };
    const markdown = renderScorecard({
      startedAt: '2026-01-01T00:00:00.000Z', baseUrl: 'http://127.0.0.1:3001', outDir: 'out',
      runs: [run], metrics: computeMetrics([run]), gate: null, feedback: null
    });
    expect(markdown).toContain('| Risk | Escalated |');
    expect(markdown).toContain('| high | yes |');
    expect(markdown).toContain('- Risk signals intact: 1 / 1');
    expect(markdown).toContain('- Escalated runs: 1 (outcome unchanged: 1)');
  });
});

const overridePrecedent = (runId: string): Precedent => ({
  id: `PREC-RUN-${runId}`, category: 'no_show', decidedAt: '2026-01-01T00:00:01.000Z', origin: 'human_override',
  ruling: 'rider_favored', remedyId: 'refund_no_show_fee', features: ['ns1_contact_met'], summary: 'Human override: probe', runId
});
const seedPrecedent: Precedent = {
  id: 'PREC-005', category: 'no_show', decidedAt: '2025-01-01T00:00:00.000Z', origin: 'seed',
  ruling: 'driver_favored', remedyId: 'keep_charge', features: ['ns1_contact_met'], summary: 'Seed precedent'
};

describe('checkFeedbackPrecedent', () => {
  const facts = fixtureFacts(dataset, 'N2');

  it('is ok when the probe run saw the human_override precedent from the overridden run', () => {
    const run = completedRun(facts, 'N2', {precedents: [seedPrecedent, overridePrecedent('run-N2H-1')]});
    expect(checkFeedbackPrecedent(run, 'run-N2H-1')).toEqual({ok: true, detail: 'ok'});
  });

  it('fails when no human_override precedent from the overridden run is present', () => {
    const run = completedRun(facts, 'N2', {precedents: [seedPrecedent, overridePrecedent('run-other')]});
    const check = checkFeedbackPrecedent(run, 'run-N2H-1');
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('no human_override precedent from run-N2H-1');
    expect(check.detail).toContain('PREC-005');
  });

  it('fails without a completed run', () => {
    expect(checkFeedbackPrecedent(null, 'run-N2H-1').ok).toBe(false);
  });
});

describe('evaluateRun — verdictMatch and verdict flags', () => {
  it('passes a completed unescalated run whose remedy equals the verdict', () => {
    const facts = fixtureFacts(dataset, 'R1');
    expect(facts.verdict.outcome).toBe('refund_route_excess');
    const result = evaluateRun(rawRun('R1', completedRun(facts, 'R1', {})), facts);
    expect(result.checks.verdictMatch.ok).toBe(true);
    expect(result.divergent).toBe(false);
    expect(result.undetermined).toBe(false);
  });

  it('is ok for a failed run — there is no ruling to check', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const result = evaluateRun(rawRun('R1', failedRun('R1', 'boom')), facts);
    expect(result.checks.verdictMatch.ok).toBe(true);
  });

  it('fails when the terminal run carries no verdict', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {verdict: null});
    const check = evaluateRun(rawRun('R1', run), facts).checks.verdictMatch;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('no policy verdict');
  });

  it('fails when the recorded verdict differs from the offline verdict', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {verdict: {...facts.verdict, outcome: 'keep_charge'}});
    const check = evaluateRun(rawRun('R1', run), facts).checks.verdictMatch;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('keep_charge');
    expect(check.detail).toContain('refund_route_excess');
  });

  it('fails an unescalated completed run whose remedy diverges from the verdict', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {});
    if (run.status !== 'completed') throw new Error('unreachable');
    const divergent = RunSchema.parse({...run, result: {...run.result, remedyId: 'keep_charge', action: {...run.result.action, remedyId: 'keep_charge', amountCents: 0, recipient: 'none'}}});
    const check = evaluateRun(rawRun('R1', divergent), facts).checks.verdictMatch;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('diverges');
  });

  it('passes a divergent completed run only when escalated with a matching divergence record', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {});
    if (run.status !== 'completed') throw new Error('unreachable');
    const base = {...run, result: {...run.result, remedyId: 'keep_charge' as const, action: {...run.result.action, remedyId: 'keep_charge' as const, amountCents: 0, recipient: 'none' as const}},
      escalation: {reasons: ['policy_divergence' as const], confidence: 0.9, threshold: 0.8, summary: 'x'}};
    const good = RunSchema.parse({...base, divergence: {judgeRemedyId: 'keep_charge', verdictOutcome: 'refund_route_excess', summary: 'x'}});
    const result = evaluateRun(rawRun('R1', good), facts);
    expect(result.checks.verdictMatch.ok).toBe(true);
    expect(result.divergent).toBe(true);
    expect(result.escalationReasons).toContain('policy_divergence');

    const noRecord = RunSchema.parse({...base});
    expect(evaluateRun(rawRun('R1', noRecord), facts).checks.verdictMatch.ok).toBe(false);

    const wrongVerdict = RunSchema.parse({...base, divergence: {judgeRemedyId: 'keep_charge', verdictOutcome: 'keep_charge', summary: 'x'}});
    const check = evaluateRun(rawRun('R1', wrongVerdict), facts).checks.verdictMatch;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('verdictOutcome');
  });

  it('fails an incomplete run whose verdict is not incomplete', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const run = completedRun(facts, 'R1', {});
    if (run.status !== 'completed') throw new Error('unreachable');
    const {result: _result, escalation: _escalation, divergence: _divergence, ...rest} = run;
    const incomplete = RunSchema.parse({...rest, status: 'incomplete', missingEvidence: ['gps: gap']});
    const check = evaluateRun(rawRun('R1', incomplete), facts).checks.verdictMatch;
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('incomplete run');
  });

  it('marks a result from an automatic re-run and keeps the wall clock', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const raw = {...rawRun('R1', completedRun(facts, 'R1', {})), retriedFrom: 'run-1', firstAttempt: failedRun('R1', 'boom'), latencyMs: 2000, wallMs: 46000};
    const result = evaluateRun(raw, facts);
    expect(result.retried).toBe(true);
    expect(result.wallMs).toBe(46000);
    expect(result.latencyMs).toBe(2000);
  });

  it('flags an undetermined verdict', () => {
    const facts = fixtureFacts(dataset, 'R1');
    const undetermined = {...facts.verdict, outcome: 'undetermined' as const, clauseIds: ['RD-3'], basis: 'conflicting rider chat signals: consent and objection'};
    const run = completedRun(facts, 'R1', {verdict: undetermined, escalation: escalation(['policy_undetermined'])});
    expect(evaluateRun(rawRun('R1', run), facts).undetermined).toBe(true);
  });
});

describe('executeRun — follows the automatic re-run', () => {
  const options = {baseUrl: 'http://eval.test', pollMs: 1, timeoutSec: 5};
  const fakeApi = (handlers: Record<string, {status?: number; body: unknown}>): typeof fetch =>
    (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const hit = handlers[`${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`];
      if (hit === undefined) return new Response('not found', {status: 404});
      return new Response(JSON.stringify(hit.body), {status: hit.status ?? 200});
    }) as typeof fetch;

  it('follows retriedBy and reports the re-run with the first attempt recorded', async () => {
    const facts = fixtureFacts(dataset, 'R1');
    const first = RunSchema.parse({...failedRun('R1', 'The operation was aborted due to timeout'), retriedBy: 'run-2'});
    const second = completedRun(facts, 'R1', {});
    const raw = await executeRun('R1', 1, {...options, fetchImpl: fakeApi({
      'POST /api/runs': {status: 202, body: {id: 'run-1'}},
      'GET /api/runs/run-1': {body: first},
      'GET /api/runs/run-2': {body: second},
    })});
    expect(raw.retriedFrom).toBe('run-1');
    expect(raw.firstAttempt?.status).toBe('failed');
    expect(raw.runId).toBe('run-2');
    expect(raw.run?.status).toBe('completed');
    // latencyMs is the re-run's own event span (0 ms — the synthetic run has one event); wallMs is the whole round trip.
    expect(raw.latencyMs).toBe(0);
    expect(raw.wallMs).toBeGreaterThanOrEqual(raw.latencyMs);
  });

  it('does not follow a failed run without retriedBy', async () => {
    const first = failedRun('R1', 'unparseable output after repairs');
    const raw = await executeRun('R1', 1, {...options, fetchImpl: fakeApi({
      'POST /api/runs': {status: 202, body: {id: 'run-1'}},
      'GET /api/runs/run-1': {body: first},
    })});
    expect(raw.retriedFrom).toBeNull();
    expect(raw.firstAttempt).toBeNull();
    expect(raw.run?.status).toBe('failed');
  });
});

describe('reviewRun', () => {
  const options = {baseUrl: 'http://eval.test', pollMs: 1, timeoutSec: 5};
  const fetchWith = (status: number, body: string): typeof fetch =>
    (async () => new Response(body, {status})) as typeof fetch;

  it('returns the parsed run on a 200 response', async () => {
    const facts = fixtureFacts(dataset, 'N2H');
    const run = completedRun(facts, 'N2H', {risk: facts.expectedRisk, escalation: escalation(['high_risk'])});
    if (run.status !== 'completed') throw new Error('unreachable');
    const reviewed = RunSchema.parse({...run, review: {decision: 'confirmed', decidedAt: '2026-01-01T00:00:02.000Z', note: 'probe', ruling: run.result.ruling, action: run.result.action}});
    const {run: parsed, problem} = await reviewRun(run.id, {decision: 'confirmed', note: 'probe'}, {...options, fetchImpl: fetchWith(200, JSON.stringify(reviewed))});
    expect(problem).toBeNull();
    expect(parsed?.id).toBe(run.id);
    expect(parsed?.status === 'completed' && parsed.review?.decision === 'confirmed').toBe(true);
  });

  it('reports a problem when the body is not a valid run', async () => {
    const {run, problem} = await reviewRun('run-1', {decision: 'confirmed', note: ''}, {...options, fetchImpl: fetchWith(200, '{"nope":true}')});
    expect(run).toBeNull();
    expect(problem).not.toBeNull();
  });

  it('reports HTTP status on a non-2xx response', async () => {
    const {run, problem} = await reviewRun('run-1', {decision: 'confirmed', note: ''}, {...options, fetchImpl: fetchWith(409, '{"error":{"code":"REVIEW_NOT_ALLOWED","message":"already reviewed"}}')});
    expect(run).toBeNull();
    expect(problem).toBe('HTTP 409');
  });
});
