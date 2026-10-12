import { describe, expect, it } from 'vitest';
import { loadDataset } from '@fairtrip/evidence';
import { releaseGate } from '../src/gate.js';
import type { RunChecks, RunResult } from '../src/report.js';
import { planRuns } from '../src/sets.js';

const dataset = loadDataset();

function allOk(): RunChecks {
  const ok = {ok: true, detail: 'ok'};
  return {statusMatch: ok, remedyMatch: ok, amountExact: ok, citationsValid: ok, traceComplete: ok, noReasoningLeak: ok, withinDeadline: ok};
}

function result(fixtureId: string, attempt: number, overrides: Partial<RunResult> = {}): RunResult {
  const expected = dataset.expected.find(outcome => outcome.fixtureId === fixtureId);
  if (expected === undefined) throw new Error(`no expected outcome for ${fixtureId}`);
  return {
    fixtureId, attempt, runId: `run-${fixtureId}-${attempt}`, status: expected.expectedStatus,
    remedyId: expected.expectedRemedyId, amountCents: expected.expectedAmountCents,
    latencyMs: 1000, passed: true, checks: allOk(), decisiveCoverage: null, problem: null, ...overrides
  };
}

const releaseSet = (): RunResult[] => planRuns('release', 1, dataset).map(run => result(run.fixtureId, run.attempt));
const conditionOf = (results: RunResult[], name: string) => {
  const found = releaseGate(results).conditions.find(item => item.name === name);
  if (found === undefined) throw new Error(`no condition ${name}`);
  return found;
};

describe('releaseGate', () => {
  it('passes a complete passing release set', () => {
    const gate = releaseGate(releaseSet());
    expect(gate.passed).toBe(true);
    expect(gate.conditions.map(item => item.name)).toEqual([
      'golden-pass-once', 'r1-n2-three-consecutive', 'missing-evidence-incomplete', 'variation-fairness-injection', 'deadline-and-contract'
    ]);
  });

  it('R1 attempt 2 failing breaks r1-n2-three-consecutive', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R1' && run.attempt === 2
      ? {...run, passed: false, checks: {...run.checks, amountExact: {ok: false, detail: 'wrong'}}}
      : run);
    expect(conditionOf(results, 'r1-n2-three-consecutive').ok).toBe(false);
    expect(releaseGate(results).passed).toBe(false);
  });

  it('X1 completed breaks missing-evidence-incomplete', () => {
    const results = releaseSet().map(run => run.fixtureId === 'X1' ? {...run, status: 'completed'} : run);
    expect(conditionOf(results, 'missing-evidence-incomplete').ok).toBe(false);
  });

  it('a 95 s run breaks deadline-and-contract', () => {
    const results = releaseSet().map(run => run.fixtureId === 'R2' ? {...run, latencyMs: 95000} : run);
    expect(conditionOf(results, 'deadline-and-contract').ok).toBe(false);
  });

  it('a missing N3 run fails golden-pass-once with not run', () => {
    const results = releaseSet().filter(run => run.fixtureId !== 'N3');
    const golden = conditionOf(results, 'golden-pass-once');
    expect(golden.ok).toBe(false);
    expect(golden.detail).toContain('not run');
  });
});
