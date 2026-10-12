import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDataset } from '@fairtrip/evidence';
import { executeRun } from './client.js';
import { evaluateRun, fixtureFacts, type FixtureFacts } from './checks.js';
import { releaseGate } from './gate.js';
import type { EvalReport, RunResult } from './report.js';
import { computeMetrics, renderScorecard } from './scorecard.js';
import { planRuns } from './sets.js';

export interface EvalOptions { baseUrl: string; fixtures: string; repeat: number; pollMs: number; timeoutSec: number; releaseGate: boolean; outDir: string }

export type { EvalReport, RunResult, RunChecks, CheckResult, GateResult, GateCondition, Metrics } from './report.js';
export type { RawRun, ClientOptions } from './client.js';
export type { FixtureFacts } from './checks.js';
export { executeRun } from './client.js';
export { evaluateRun, fixtureFacts } from './checks.js';
export { planRuns } from './sets.js';
export { releaseGate } from './gate.js';
export { computeMetrics, renderScorecard } from './scorecard.js';

function formatLine(result: RunResult): string {
  const seconds = (Math.round(result.latencyMs / 100) / 10).toFixed(1);
  return `${result.fixtureId} #${result.attempt} ${result.status} ${result.remedyId ?? '-'} ${result.amountCents ?? '-'} ${result.passed ? 'PASS' : 'FAIL'} ${seconds} s`;
}

export async function runEval(options: EvalOptions): Promise<EvalReport> {
  const dataset = loadDataset();
  const plan = planRuns(options.fixtures, options.repeat, dataset);
  const startedAt = new Date().toISOString();
  const runsDir = join(options.outDir, 'runs');
  mkdirSync(runsDir, {recursive: true});

  const factsCache = new Map<string, FixtureFacts>();
  const results: RunResult[] = [];
  for (const planned of plan) {
    let facts = factsCache.get(planned.fixtureId);
    if (facts === undefined) {
      facts = fixtureFacts(dataset, planned.fixtureId);
      factsCache.set(planned.fixtureId, facts);
    }
    const raw = await executeRun(planned.fixtureId, planned.attempt, {baseUrl: options.baseUrl, pollMs: options.pollMs, timeoutSec: options.timeoutSec});
    writeFileSync(join(runsDir, `${planned.fixtureId}-${planned.attempt}.json`), `${JSON.stringify(raw, null, 2)}\n`);
    const result = evaluateRun(raw, facts);
    results.push(result);
    console.log(formatLine(result));
  }

  const report: EvalReport = {
    startedAt,
    baseUrl: options.baseUrl,
    outDir: options.outDir,
    runs: results,
    metrics: computeMetrics(results),
    gate: options.releaseGate ? releaseGate(results) : null
  };
  writeFileSync(join(options.outDir, 'scorecard.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(options.outDir, 'scorecard.md'), renderScorecard(report));
  return report;
}
