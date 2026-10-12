import type { EvalReport, Metrics, RunChecks, RunResult } from './report.js';

const toSeconds = (ms: number): number => Math.round(ms / 100) / 10;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) return null;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}

function groupByFixture(results: RunResult[]): Map<string, RunResult[]> {
  const groups = new Map<string, RunResult[]>();
  for (const result of results) {
    const group = groups.get(result.fixtureId) ?? [];
    group.push(result);
    groups.set(result.fixtureId, group);
  }
  return groups;
}

export function computeMetrics(results: RunResult[]): Metrics {
  const groups = groupByFixture(results);
  let fixturesPassed = 0;
  let repeatedFixtures = 0;
  let consistentFixtures = 0;
  for (const runs of groups.values()) {
    if (runs.every(run => run.passed)) fixturesPassed += 1;
    if (runs.length > 1) {
      repeatedFixtures += 1;
      const signatures = new Set(runs.map(run => JSON.stringify([run.status, run.remedyId, run.amountCents])));
      if (signatures.size === 1) consistentFixtures += 1;
    }
  }
  const latencies = results.map(result => result.latencyMs);
  const p50 = median(latencies);
  return {
    runs: results.length,
    runsPassed: results.filter(result => result.passed).length,
    fixturesRun: groups.size,
    fixturesPassed,
    exactMoney: results.filter(result => result.checks.amountExact.ok).length,
    citationValid: results.filter(result => result.checks.citationsValid.ok).length,
    traceComplete: results.filter(result => result.checks.traceComplete.ok).length,
    consistentFixtures,
    repeatedFixtures,
    p50LatencySec: p50 === null ? null : toSeconds(p50),
    maxLatencySec: latencies.length === 0 ? null : toSeconds(Math.max(...latencies))
  };
}

export function failingChecks(checks: RunChecks): string[] {
  return Object.entries(checks).filter(([, check]) => !check.ok).map(([name]) => name);
}

const cell = (value: string): string => value.replace(/\|/g, '\\|');
const seconds = (value: number | null): string => (value === null ? 'n/a' : `${value.toFixed(1)} s`);

export function renderScorecard(report: EvalReport): string {
  const m = report.metrics;
  const lines: string[] = [
    '# FairTrip evaluation scorecard',
    '',
    `- Date: ${report.startedAt}`,
    `- Base URL: ${report.baseUrl}`,
    `- Output folder: ${report.outDir}`,
    '- Data: synthetic fixtures; policy: demonstration policy.',
    '',
    '## Runs',
    '',
    '| Fixture | Attempt | Status | Remedy | Amount (cents) | Latency | Pass | Failing checks |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const run of report.runs) {
    const failing = failingChecks(run.checks);
    lines.push(`| ${cell(run.fixtureId)} | ${run.attempt} | ${cell(run.status)} | ${run.remedyId ?? '-'} | ${run.amountCents ?? '-'} | ${seconds(toSeconds(run.latencyMs))} | ${run.passed ? 'PASS' : 'FAIL'} | ${failing.length ? failing.join(', ') : '-'} |`);
  }
  lines.push(
    '',
    '## Metrics',
    '',
    `- Runs passed: ${m.runsPassed} / ${m.runs}`,
    `- Fixtures passed: ${m.fixturesPassed} / ${m.fixturesRun}`,
    `- Exact money: ${m.exactMoney} / ${m.runs}`,
    `- Citation validity: ${m.citationValid} / ${m.runs}`,
    `- Trace completeness: ${m.traceComplete} / ${m.runs}`,
    `- Consistency: ${m.consistentFixtures} / ${m.repeatedFixtures} repeated fixtures`,
    `- p50 latency: ${seconds(m.p50LatencySec)}`,
    `- Max latency: ${seconds(m.maxLatencySec)}`,
    'Token usage: not measured (the API does not report it).'
  );
  if (report.gate !== null) {
    lines.push('', '## Release gate', '', `Release gate: ${report.gate.passed ? 'PASS' : 'FAIL'}`, '');
    for (const item of report.gate.conditions) lines.push(`- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'} (${item.detail})`);
  }
  lines.push('');
  return lines.join('\n');
}
