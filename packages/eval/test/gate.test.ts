import { describe, expect, it } from 'vitest';
import { loadDataset } from '@fairtrip/evidence';
import { releaseGate } from '../src/gate.js';
import type { FeedbackProbe, RunChecks, RunResult } from '../src/report.js';
import { planRuns } from '../src/sets.js';

const dataset = loadDataset();

function allOk(): RunChecks {
  const ok = {ok: true, detail: 'ok'};
  return {statusMatch: ok, remedyMatch: ok, amountExact: ok, citationsValid: ok, traceComplete: ok, noReasoningLeak: ok, withinDeadline: ok, riskSignalsIntact: ok, contextOnly: ok, verdictMatch: ok};
}

function result(fixtureId: string, attempt: number, overrides: Partial<RunResult> = {}): RunResult {
  const expected = dataset.expected.find(outcome => outcome.fixtureId === fixtureId);
  if (expected === undefined) throw new Error(`no expected outcome for ${fixtureId}`);
  return {
    fixtureId, attempt, runId: `run-${fixtureId}-${attempt}`, status: expected.expectedStatus,
    remedyId: expected.expectedRemedyId, amountCents: expected.expectedAmountCents,
    latencyMs: 1000, passed: true, checks: allOk(), decisiveCoverage: null, problem: null, escalated: false, riskOverall: null,
    failureClass: null, roleLatencySec: {},
    escalationReasons: [], divergent: false, undetermined: false, retried: false, wallMs: 1000,
    modelStats: {callSec: {toolRequest: [], case: [], judge: [], risk: []}, directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0},
    ...overrides
  };
}

const releaseSet = (): RunResult[] => planRuns('release', 1, dataset).map(run => result(run.fixtureId, run.attempt));
const probeRun = (overrides: Partial<RunResult> = {}): RunResult =>
  result('N2', 4, {probe: 'feedback', feedbackPrecedent: {ok: true, detail: 'ok'}, ...overrides});
const cleanFeedback = (overrides: Partial<FeedbackProbe> = {}): FeedbackProbe => ({
  confirmFixtureId: 'X2', confirmRunId: 'run-X2-1',
  overrideFixtureId: 'N2H', overrideRunId: 'run-N2H-1', overrideRemedyId: 'refund_no_show_fee',
  overrideAmountCents: 500, expectedOverrideAmountCents: 500, problems: [], ...overrides
});
const conditionOf = (results: RunResult[], name: string, feedback: FeedbackProbe | null = null) => {
  const found = releaseGate(results, feedback).conditions.find(item => item.name === name);
  if (found === undefined) throw new Error(`no condition ${name}`);
  return found;
};

describe('releaseGate', () => {
  it('passes a complete passing release set with a clean feedback probe', () => {
    const results = [...releaseSet(), probeRun()];
    const gate = releaseGate(results, cleanFeedback());
    expect(gate.passed).toBe(true);
    expect(gate.conditions.map(item => item.name)).toEqual([
      'golden-pass-once', 'consistency-three-consecutive', 'missing-evidence-incomplete', 'variation-fairness-injection', 'deadline-and-contract', 'risk-context-only', 'policy-verdict-authoritative', 'human-review-feedback'
    ]);
  });

  it('R1F attempt 2 failing breaks consistency-three-consecutive', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R1F' && run.attempt === 2
      ? {...run, passed: false, checks: {...run.checks, amountExact: {ok: false, detail: 'wrong'}}}
      : run);
    expect(conditionOf(results, 'consistency-three-consecutive').ok).toBe(false);
    expect(releaseGate(results, cleanFeedback()).passed).toBe(false);
  });

  it('X1 completed breaks missing-evidence-incomplete', () => {
    const results = releaseSet().map(run => run.fixtureId === 'X1' ? {...run, status: 'completed'} : run);
    expect(conditionOf(results, 'missing-evidence-incomplete').ok).toBe(false);
  });

  it('X4 and X5 are covered by missing-evidence-incomplete', () => {
    for (const id of ['X4', 'X5']) {
      const results = releaseSet().filter(run => run.fixtureId !== id);
      const condition = conditionOf(results, 'missing-evidence-incomplete');
      expect(condition.ok).toBe(false);
      expect(condition.detail).toContain(`${id}: not run`);
    }
  });

  it('a failing N6 run breaks variation-fairness-injection', () => {
    const results = releaseSet().map(run => run.fixtureId === 'N6' ? {...run, passed: false} : run);
    const condition = conditionOf(results, 'variation-fairness-injection');
    expect(condition.ok).toBe(false);
    expect(condition.detail).toContain('N6 #1');
  });

  it('a 95 s run breaks deadline-and-contract', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R2' ? {...run, latencyMs: 95000} : run);
    expect(conditionOf(results, 'deadline-and-contract').ok).toBe(false);
  });

  it('a missing N4 run fails golden-pass-once with not run', () => {
    const results = releaseSet().filter(run => run.fixtureId !== 'N4');
    const golden = conditionOf(results, 'golden-pass-once');
    expect(golden.ok).toBe(false);
    expect(golden.detail).toContain('N4: not run');
  });
});

describe('releaseGate — policy-verdict-authoritative', () => {
  it('passes the clean release set', () => {
    expect(conditionOf(releaseSet(), 'policy-verdict-authoritative').ok).toBe(true);
  });

  it('fails on a run whose verdictMatch check is not ok', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R2'
      ? {...run, checks: {...run.checks, verdictMatch: {ok: false, detail: 'run carries no policy verdict'}}}
      : run);
    const condition = conditionOf(results, 'policy-verdict-authoritative');
    expect(condition.ok).toBe(false);
    expect(condition.detail).toContain('R2 #1');
    expect(condition.detail).toContain('no policy verdict');
  });

  it('fails when a divergent completed run is not escalated', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R2'
      ? {...run, status: 'completed' as const, divergent: true, escalated: false}
      : run);
    const condition = conditionOf(results, 'policy-verdict-authoritative');
    expect(condition.ok).toBe(false);
    expect(condition.detail).toContain('not escalated');
  });
});

describe('releaseGate — human-review-feedback', () => {
  const condition = (results: RunResult[], feedback: FeedbackProbe | null) =>
    conditionOf(results, 'human-review-feedback', feedback);

  it('fails with "not run" when no feedback was collected', () => {
    const found = condition(releaseSet(), null);
    expect(found.ok).toBe(false);
    expect(found.detail).toContain('not run');
    expect(releaseGate(releaseSet()).passed).toBe(false);
  });

  it('passes with a clean probe', () => {
    expect(condition([...releaseSet(), probeRun()], cleanFeedback()).ok).toBe(true);
  });

  it('fails on each recorded problem', () => {
    const found = condition([...releaseSet(), probeRun()], cleanFeedback({problems: ['X2 review: HTTP 409', 'N2H override amount 0 !== eligible 500']}));
    expect(found.ok).toBe(false);
    expect(found.detail).toContain('X2 review: HTTP 409');
    expect(found.detail).toContain('N2H override amount 0 !== eligible 500');
  });

  it('fails when the probe run is missing from the results', () => {
    const found = condition(releaseSet(), cleanFeedback());
    expect(found.ok).toBe(false);
    expect(found.detail).toContain('feedback probe run missing');
  });

  it('fails when the probe run failed', () => {
    const found = condition([...releaseSet(), probeRun({passed: false})], cleanFeedback());
    expect(found.ok).toBe(false);
    expect(found.detail).toContain('feedback probe failed');
  });

  it('fails when the probe run feedbackPrecedent check is not ok', () => {
    const found = condition([...releaseSet(), probeRun({feedbackPrecedent: {ok: false, detail: 'no human_override precedent'}})], cleanFeedback());
    expect(found.ok).toBe(false);
    expect(found.detail).toContain('no human_override precedent');
  });
});
