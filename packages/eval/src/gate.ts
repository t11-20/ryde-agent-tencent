import type { FeedbackProbe, GateCondition, GateResult, RunResult } from './report.js';
import { GOLDEN_FIXTURES, RELEASE_TRIPLE_FIXTURES } from './sets.js';

const MISSING_EVIDENCE_FIXTURES = ['X1', 'X4', 'X3', 'X5'] as const;
const VARIATION_FIXTURES = ['R1S', 'N2H', 'X2', 'R1F', 'N1R', 'N5', 'N6', 'X6'] as const;
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

function consistencyThreeConsecutive(results: RunResult[]): GateCondition {
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
  return condition('consistency-three-consecutive', failures);
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

function riskContextOnly(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const run of results) {
    if (run.status !== 'completed') continue;
    if (!run.checks.riskSignalsIntact.ok) failures.push(`${run.fixtureId} #${run.attempt}: ${run.checks.riskSignalsIntact.detail}`);
    if (!run.checks.contextOnly.ok) failures.push(`${run.fixtureId} #${run.attempt}: ${run.checks.contextOnly.detail}`);
  }
  return condition('risk-context-only', failures);
}

// The deterministic policy verdict is authoritative: every run must reproduce it
// (verdictMatch), and a divergent completed ruling must never be finalised.
function policyVerdictAuthoritative(results: RunResult[]): GateCondition {
  const failures: string[] = [];
  for (const run of results) {
    if (!run.checks.verdictMatch.ok) failures.push(`${run.fixtureId} #${run.attempt}: ${run.checks.verdictMatch.detail}`);
    else if (run.status === 'completed' && run.divergent && !run.escalated)
      failures.push(`${run.fixtureId} #${run.attempt}: divergent ruling was not escalated`);
  }
  return condition('policy-verdict-authoritative', failures);
}

function humanReviewFeedback(results: RunResult[], feedback: FeedbackProbe | null): GateCondition {
  if (feedback === null) return condition('human-review-feedback', ['not run']);
  const failures = [...feedback.problems];
  const probe = results.find(run => run.probe === 'feedback');
  if (probe === undefined) failures.push('feedback probe run missing');
  else {
    if (!probe.passed) failures.push(`${probe.fixtureId} #${probe.attempt} feedback probe failed`);
    if (probe.feedbackPrecedent === undefined) failures.push('feedback probe run missing feedbackPrecedent check');
    else if (!probe.feedbackPrecedent.ok) failures.push(`feedback precedent: ${probe.feedbackPrecedent.detail}`);
  }
  return condition('human-review-feedback', failures);
}

export function releaseGate(results: RunResult[], feedback: FeedbackProbe | null = null): GateResult {
  const conditions = [
    goldenPassOnce(results),
    consistencyThreeConsecutive(results),
    missingEvidenceIncomplete(results),
    variationFairnessInjection(results),
    deadlineAndContract(results),
    riskContextOnly(results),
    policyVerdictAuthoritative(results),
    humanReviewFeedback(results, feedback)
  ];
  return {passed: conditions.every(item => item.ok), conditions};
}
