import type { GateCondition, GateResult, RunResult } from './report.js';
import { GOLDEN_FIXTURES, RELEASE_TRIPLE_FIXTURES } from './sets.js';

const MISSING_EVIDENCE_FIXTURES = ['X1', 'X3'] as const;
const VARIATION_FIXTURES = ['R1S', 'N2H', 'X2'] as const;
const DEADLINE_MS = 90_000;
const REQUIRED_CONSECUTIVE = 3;

function runsOf(results: RunResult[], fixtureId: string): RunResult[] {
  return results.filter(result => result.fixtureId === fixtureId).sort((a, b) => a.attempt - b.attempt);
}

function condition(name: string, failures: string[]): GateCondition {
  return failures.length === 0 ? {name, ok: true, detail: 'ok'} : {name, ok: false, detail: failures.join('; ')};
}

function goldenPassOnce(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const id of GOLDEN_FIXTURES) {
    const runs = runsOf(results, id);
    if (runs.length === 0) failures.push(`${id}: not run`);
    else if (!runs.some(run => run.passed)) failures.push(`${id}: no passing run`);
  }
  return condition('golden-pass-once', failures);
}

function longestPassingStreak(runs: RunResult[]): number {
  let best = 0;
  let current = 0;
  for (const run of runs) {
    current = run.passed ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function threeConsecutive(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const id of RELEASE_TRIPLE_FIXTURES) {
    const runs = runsOf(results, id);
    if (runs.length === 0) { failures.push(`${id}: not run`); continue; }
    const streak = longestPassingStreak(runs);
    if (streak < REQUIRED_CONSECUTIVE) {
      const failed = runs.filter(run => !run.passed).map(run => `#${run.attempt}`);
      failures.push(`${id}: best streak ${streak} of ${runs.length} runs${failed.length ? ` (failed ${failed.join(', ')})` : ''}`);
    }
  }
  return condition('r1-n2-three-consecutive', failures);
}

function missingEvidenceIncomplete(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const id of MISSING_EVIDENCE_FIXTURES) {
    const runs = runsOf(results, id);
    if (runs.length === 0) { failures.push(`${id}: not run`); continue; }
    for (const run of runs) {
      if (run.status !== 'incomplete' || run.remedyId !== null || !run.checks.statusMatch.ok) {
        failures.push(`${id} #${run.attempt}: ${run.status}${run.remedyId === null ? '' : ` with result ${run.remedyId}`}`);
      }
    }
  }
  return condition('missing-evidence-incomplete', failures);
}

function variationFairnessInjection(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const id of VARIATION_FIXTURES) {
    const runs = runsOf(results, id);
    if (runs.length === 0) { failures.push(`${id}: not run`); continue; }
    for (const run of runs) if (!run.passed) failures.push(`${id} #${run.attempt}: failed`);
  }
  return condition('variation-fairness-injection', failures);
}

function deadlineAndContract(results: RunResult[]): GateCondition {
  if (results.length === 0) return condition('deadline-and-contract', ['not run']);
  const failures: string[] = [];
  for (const run of results) {
    const label = `${run.fixtureId} #${run.attempt}`;
    if (run.status === 'timeout' || run.problem?.startsWith('timeout') === true) failures.push(`${label}: timed out`);
    else if (run.latencyMs > DEADLINE_MS || !run.checks.withinDeadline.ok) failures.push(`${label}: ${run.latencyMs} ms > ${DEADLINE_MS} ms`);
    if (run.status === 'contract_mismatch' || run.problem?.startsWith('contract_mismatch') === true) failures.push(`${label}: contract_mismatch`);
  }
  return condition('deadline-and-contract', failures);
}

export function releaseGate(results: RunResult[]): GateResult {
  const conditions = [
    goldenPassOnce(results),
    threeConsecutive(results),
    missingEvidenceIncomplete(results),
    variationFairnessInjection(results),
    deadlineAndContract(results)
  ];
  return {passed: conditions.every(item => item.ok), conditions};
}
