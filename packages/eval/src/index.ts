import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadDataset } from '@fairtrip/evidence';
import { executeRun, reviewRun, type ClientOptions } from './client.js';
import { checkFeedbackPrecedent, evaluateRun, fixtureFacts, type FixtureFacts } from './checks.js';
import { releaseGate } from './gate.js';
import type { EvalReport, FeedbackProbe, RunResult } from './report.js';
import { computeMetrics, renderScorecard } from './scorecard.js';
import { planRuns } from './sets.js';

export interface EvalOptions { baseUrl: string; fixtures: string; repeat: number; pollMs: number; timeoutSec: number; releaseGate: boolean; outDir: string }

export type { EvalReport, RunResult, RunChecks, CheckResult, GateResult, GateCondition, Metrics, FeedbackProbe, FailureClass, AgentRole } from './report.js';
export type { RawRun, ClientOptions } from './client.js';
export type { FixtureFacts } from './checks.js';
export { executeRun, reviewRun } from './client.js';
export { checkFeedbackPrecedent, classifyFailure, evaluateRun, fixtureFacts } from './checks.js';
export { planRuns } from './sets.js';
export { releaseGate } from './gate.js';
export { computeMetrics, renderScorecard } from './scorecard.js';

function formatLine(result: RunResult): string {
  const seconds = (Math.round(result.latencyMs / 100) / 10).toFixed(1);
  const wall = result.wallMs !== result.latencyMs ? ` (wall ${(Math.round(result.wallMs / 100) / 10).toFixed(1)} s)` : '';
  const retried = result.retried ? ' (re-run)' : '';
  return `${result.fixtureId} #${result.attempt}${retried} ${result.status} ${result.remedyId ?? '-'} ${result.amountCents ?? '-'} ${result.passed ? 'PASS' : 'FAIL'} ${seconds} s${wall}`;
}

function reviewableResult(results: RunResult[], fixtureId: string): RunResult | null {
  const result = results.find(run => run.fixtureId === fixtureId && run.attempt === 1);
  if (result === undefined || result.runId === null || result.status !== 'completed' || !result.escalated) return null;
  return result;
}

async function runFeedbackProbe(
  results: RunResult[], factsFor: (fixtureId: string) => FixtureFacts, clientOptions: ClientOptions, runsDir: string
): Promise<FeedbackProbe> {
  const feedback: FeedbackProbe = {
    confirmFixtureId: 'X2', confirmRunId: null,
    overrideFixtureId: 'N2H', overrideRunId: null, overrideRemedyId: 'refund_no_show_fee',
    overrideAmountCents: null, expectedOverrideAmountCents: null, problems: []
  };
  const x2 = reviewableResult(results, 'X2');
  const n2h = reviewableResult(results, 'N2H');
  if (x2 === null) feedback.problems.push('X2 #1 not escalated/completed');
  if (n2h === null) feedback.problems.push('N2H #1 not escalated/completed');

  // Confirm first so that the override below stays the most recent precedent for the probe run.
  if (x2 !== null && x2.runId !== null) {
    feedback.confirmRunId = x2.runId;
    const {run, problem} = await reviewRun(x2.runId, {decision: 'confirmed', note: 'Release-gate feedback probe: confirmation of the Judge ruling.'}, clientOptions);
    if (problem !== null) feedback.problems.push(`X2 review: ${problem}`);
    else if (run === null || run.status !== 'completed' || run.review === undefined) feedback.problems.push('X2 review: no review on the returned run');
    else {
      if (run.review.decision !== 'confirmed') feedback.problems.push(`X2 review decision ${run.review.decision}, expected confirmed`);
      if (run.review.action.remedyId !== x2.remedyId || run.review.action.amountCents !== x2.amountCents)
        feedback.problems.push(`X2 review changed the action to ${run.review.action.remedyId} ${run.review.action.amountCents}`);
    }
  }

  let overrideOk = false;
  if (n2h !== null && n2h.runId !== null) {
    feedback.overrideRunId = n2h.runId;
    feedback.expectedOverrideAmountCents = factsFor('N2H').eligibleCents.refund_no_show_fee;
    const {run, problem} = await reviewRun(n2h.runId, {
      decision: 'overridden', remedyId: 'refund_no_show_fee',
      note: 'Release-gate feedback probe: synthetic override, not a real decision.'
    }, clientOptions);
    if (problem !== null) feedback.problems.push(`N2H review: ${problem}`);
    else if (run === null || run.status !== 'completed' || run.review === undefined) feedback.problems.push('N2H review: no review on the returned run');
    else {
      feedback.overrideAmountCents = run.review.action.amountCents;
      if (run.review.decision !== 'overridden') feedback.problems.push(`N2H review decision ${run.review.decision}, expected overridden`);
      if (feedback.expectedOverrideAmountCents === null) feedback.problems.push('N2H refund_no_show_fee eligible cents unknown');
      else if (feedback.overrideAmountCents !== feedback.expectedOverrideAmountCents)
        feedback.problems.push(`N2H override amount ${feedback.overrideAmountCents} !== eligible ${feedback.expectedOverrideAmountCents}`);
      overrideOk = run.review.decision === 'overridden' && feedback.overrideAmountCents !== null
        && feedback.overrideAmountCents === feedback.expectedOverrideAmountCents;
    }
  }

  if (!overrideOk) {
    feedback.problems.push('probe run skipped: override failed');
    return feedback;
  }
  const attempt = Math.max(0, ...results.filter(run => run.fixtureId === 'N2').map(run => run.attempt)) + 1;
  const raw = await executeRun('N2', attempt, clientOptions);
  writeFileSync(join(runsDir, `N2-${attempt}-feedback.json`), `${JSON.stringify(raw, null, 2)}\n`);
  const result = evaluateRun(raw, factsFor('N2'));
  result.probe = 'feedback';
  result.feedbackPrecedent = checkFeedbackPrecedent(raw.run, n2h?.runId ?? '');
  results.push(result);
  console.log(`${formatLine(result)} (feedback probe)`);
  return feedback;
}

const HealthModelSchema = z.looseObject({model: z.looseObject({provider: z.string(), thinking: z.string(), serviceTier: z.string()}).optional()});

// The scorecard header reports the API's model settings for A/B comparisons.
async function fetchModelSettings(baseUrl: string): Promise<{provider: string; thinking: string; serviceTier: string} | undefined> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`);
    if (!response.ok) return undefined;
    const parsed = HealthModelSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.model : undefined;
  } catch {
    return undefined;
  }
}

export async function runEval(options: EvalOptions): Promise<EvalReport> {
  const dataset = loadDataset();
  const plan = planRuns(options.fixtures, options.repeat, dataset);
  const startedAt = new Date().toISOString();
  const runsDir = join(options.outDir, 'runs');
  mkdirSync(runsDir, {recursive: true});

  const factsCache = new Map<string, FixtureFacts>();
  const factsFor = (fixtureId: string): FixtureFacts => {
    let facts = factsCache.get(fixtureId);
    if (facts === undefined) {
      facts = fixtureFacts(dataset, fixtureId);
      factsCache.set(fixtureId, facts);
    }
    return facts;
  };
  const results: RunResult[] = [];
  for (const planned of plan) {
    const raw = await executeRun(planned.fixtureId, planned.attempt, {baseUrl: options.baseUrl, pollMs: options.pollMs, timeoutSec: options.timeoutSec});
    writeFileSync(join(runsDir, `${planned.fixtureId}-${planned.attempt}.json`), `${JSON.stringify(raw, null, 2)}\n`);
    const result = evaluateRun(raw, factsFor(planned.fixtureId));
    results.push(result);
    console.log(formatLine(result));
  }

  const feedback = options.releaseGate
    ? await runFeedbackProbe(results, factsFor, {baseUrl: options.baseUrl, pollMs: options.pollMs, timeoutSec: options.timeoutSec}, runsDir)
    : null;

  const model = await fetchModelSettings(options.baseUrl);
  const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const relOut = relative(repoRoot, resolve(options.outDir)).replace(/\\/g, '/');
  const displayOutDir = relOut && !relOut.startsWith('..') && !isAbsolute(relOut) ? relOut : (basename(options.outDir) || options.outDir);
  const report: EvalReport = {
    startedAt,
    baseUrl: options.baseUrl,
    // Repo-relative (or folder name if outside repo) so scorecards carry no local user or machine path.
    outDir: displayOutDir,
    runs: results,
    metrics: computeMetrics(results, feedback),
    gate: options.releaseGate ? releaseGate(results, feedback) : null,
    feedback,
    ...(model === undefined ? {} : {model})
  };
  writeFileSync(join(options.outDir, 'scorecard.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(options.outDir, 'scorecard.md'), renderScorecard(report));
  return report;
}
