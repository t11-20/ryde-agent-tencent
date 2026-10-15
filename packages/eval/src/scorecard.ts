import type { AgentRole, EvalReport, FailureClass, FeedbackProbe, Metrics, ModelCallStat, RunChecks, RunResult } from './report.js';

const FAILURE_CLASSES: FailureClass[] = ['provider_timeout', 'provider_network', 'run_deadline', 'model_output', 'outcome_mismatch', 'check_failure'];
const AGENT_ROLES: AgentRole[] = ['rider', 'driver', 'risk', 'judge'];

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

// Nearest-rank percentile for p90.
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index] ?? null;
}

const round1 = (value: number | null): number | null => (value === null ? null : Math.round(value * 10) / 10);

function callStat(values: number[]): ModelCallStat {
  return {p50: round1(median(values)), p90: round1(percentile(values, 0.9)), max: values.length === 0 ? null : round1(Math.max(...values))};
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

function feedbackProbeStatus(results: RunResult[], feedback: FeedbackProbe | null): Metrics['feedbackProbe'] {
  if (feedback === null) return 'not run';
  const probe = results.find(run => run.probe === 'feedback');
  const probeOk = probe !== undefined && probe.passed && probe.feedbackPrecedent?.ok === true;
  return feedback.problems.length === 0 && probeOk ? 'pass' : 'fail';
}

export function computeMetrics(results: RunResult[], feedback: FeedbackProbe | null = null): Metrics {
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
  const failureClasses = Object.fromEntries(FAILURE_CLASSES.map(name => [name, 0])) as Record<FailureClass, number>;
  for (const result of results) if (result.failureClass !== null) failureClasses[result.failureClass] += 1;
  const roleLatency = {} as Record<AgentRole, {p50: number | null; max: number | null}>;
  for (const role of AGENT_ROLES) {
    const samples = results.map(result => result.roleLatencySec[role]).filter((value): value is number => value !== undefined);
    const roleMedian = median(samples);
    roleLatency[role] = {
      p50: roleMedian === null ? null : Math.round(roleMedian * 10) / 10,
      max: samples.length === 0 ? null : Math.round(Math.max(...samples) * 10) / 10
    };
  }
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
    maxLatencySec: latencies.length === 0 ? null : toSeconds(Math.max(...latencies)),
    riskIntact: results.filter(result => result.checks.riskSignalsIntact.ok).length,
    escalatedRuns: results.filter(result => result.escalated).length,
    escalatedOutcomeUnchanged: results.filter(result => result.escalated && result.checks.remedyMatch.ok && result.checks.amountExact.ok).length,
    feedbackProbe: feedbackProbeStatus(results, feedback),
    failureClasses,
    roleLatency,
    verdictAgree: results.filter(result => result.status === 'completed' && !result.escalated && result.checks.verdictMatch.ok).length,
    divergentRuns: results.filter(result => result.divergent).length,
    undeterminedRuns: results.filter(result => result.undetermined).length,
    providerRetries: results.filter(result => result.retried).length,
    modelCalls: {
      toolRequest: callStat(results.flatMap(result => result.modelStats.callSec.toolRequest)),
      case: callStat(results.flatMap(result => result.modelStats.callSec.case)),
      judge: callStat(results.flatMap(result => result.modelStats.callSec.judge)),
      risk: {
        p50: round1(median(results.flatMap(result => result.modelStats.callSec.risk))),
        max: (values => values.length === 0 ? null : round1(Math.max(...values)))(results.flatMap(result => result.modelStats.callSec.risk))
      }
    },
    directedRepairs: results.reduce((total, result) => total + result.modelStats.directedRepairs, 0),
    normalisations: results.reduce((total, result) => total + result.modelStats.normalisations, 0),
    callRetries: results.reduce((total, result) => total + result.modelStats.callRetries, 0),
    hedgesFired: results.reduce((total, result) => total + result.modelStats.hedgesFired, 0),
    hedgesWon: results.reduce((total, result) => total + result.modelStats.hedgesWon, 0)
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
    `- Model settings: ${report.model === undefined ? 'n/a' : `provider=${report.model.provider} · thinking=${report.model.thinking} · service tier=${report.model.serviceTier}`}`,
    `- Output folder: ${report.outDir}`,
    '- Data: synthetic fixtures; policy: demonstration policy.',
    '',
    '## Runs',
    '',
    '| Fixture | Attempt | Status | Remedy | Amount (cents) | Risk | Escalated | Latency | Pass | Failure class | Failing checks |',
    '|---|---|---|---|---|---|---|---|---|---|---|'
  ];
  for (const run of report.runs) {
    const failing = failingChecks(run.checks);
    const base = run.probe === 'feedback' ? `${run.fixtureId} (feedback probe)` : run.fixtureId;
    const fixtureCell = run.retried ? `${base} (re-run)` : base;
    const latency = seconds(toSeconds(run.latencyMs));
    // A retried result's latency is the re-run's own span; wall covers both attempts.
    const latencyCell = toSeconds(run.wallMs) !== toSeconds(run.latencyMs) ? `${latency} (wall ${seconds(toSeconds(run.wallMs))})` : latency;
    lines.push(`| ${cell(fixtureCell)} | ${run.attempt} | ${cell(run.status)} | ${run.remedyId ?? '-'} | ${run.amountCents ?? '-'} | ${run.riskOverall ?? '-'} | ${run.escalated ? 'yes' : 'no'} | ${latencyCell} | ${run.passed ? 'PASS' : 'FAIL'} | ${run.failureClass ?? ''} | ${failing.length ? failing.join(', ') : '-'} |`);
  }
  const finalisedRuns = report.runs.filter(run => run.status === 'completed' && !run.escalated).length;
  lines.push(
    '',
    '## Metrics',
    '',
    `- Runs passed: ${m.runsPassed} / ${m.runs}`,
    `- Fixtures passed: ${m.fixturesPassed} / ${m.fixturesRun}`,
    `- Exact money: ${m.exactMoney} / ${m.runs}`,
    `- Citation validity: ${m.citationValid} / ${m.runs}`,
    `- Trace completeness: ${m.traceComplete} / ${m.runs}`,
    `- Risk signals intact: ${m.riskIntact} / ${m.runs}`,
    `- Escalated runs: ${m.escalatedRuns} (outcome unchanged: ${m.escalatedOutcomeUnchanged})`,
    `- Human-review feedback probe: ${m.feedbackProbe}`,
    `- Consistency: ${m.consistentFixtures} / ${m.repeatedFixtures} repeated fixtures`,
    `- p50 latency: ${seconds(m.p50LatencySec)}`,
    `- Max latency: ${seconds(m.maxLatencySec)}`,
    `- Failure classes: ${FAILURE_CLASSES.filter(name => m.failureClasses[name] > 0).map(name => `${name} ${m.failureClasses[name]}`).join(', ') || 'none'}`,
    `- Model time per role (whole loop, s): ${AGENT_ROLES.map(role => { const rl = m.roleLatency[role]; const fmt = (v: number | null) => (v === null ? 'n/a' : v.toFixed(1)); return `${role} p50 ${fmt(rl.p50)} / max ${fmt(rl.max)}`; }).join(' · ')}`,
    `- Policy verdict: ${m.verdictAgree} / ${finalisedRuns} finalised rulings equal the deterministic verdict; divergences escalated: ${m.divergentRuns}; undetermined: ${m.undeterminedRuns}`,
    `- Automatic re-runs after a failed first attempt: ${m.providerRetries}`,
    `- Model calls (s): ${(['toolRequest', 'case', 'judge'] as const).map(key => { const c = m.modelCalls[key]; const f = (v: number | null) => (v === null ? 'n/a' : v.toFixed(1)); return `${key === 'toolRequest' ? 'tool-request' : key} p50 ${f(c.p50)} / p90 ${f(c.p90)} / max ${f(c.max)}`; }).join(' · ')} · risk p50 ${m.modelCalls.risk.p50 === null ? 'n/a' : m.modelCalls.risk.p50.toFixed(1)} / max ${m.modelCalls.risk.max === null ? 'n/a' : m.modelCalls.risk.max.toFixed(1)}`,
    `- Directed repairs (extra model calls): ${m.directedRepairs}`,
    `- Normalisations (no extra call): ${m.normalisations}`,
    `- Call-level recoveries: retries ${m.callRetries} · hedges fired ${m.hedgesFired} (won ${m.hedgesWon})`,
    'Provider-side classes (provider_timeout, provider_network) indicate model-endpoint latency or connectivity, not a system decision error.',
    'A finalised payment can never differ from the deterministic policy verdict; disagreements are escalated for human review (policy-verdict-authoritative).',
    'Token usage: not measured (the API does not report it).'
  );
  const escalated = report.runs.filter(run => run.escalated);
  if (escalated.length > 0) {
    lines.push('', '## Escalated runs', '');
    for (const run of escalated) {
      const label = run.probe === 'feedback' ? `${run.fixtureId} (feedback probe)` : run.fixtureId;
      const reasons = run.escalationReasons.length === 0 ? '' : ` — ${run.escalationReasons.join(', ')}`;
      lines.push(`- ${label} #${run.attempt} — risk ${run.riskOverall ?? 'unknown'} — ${run.remedyId ?? 'none'} ${run.amountCents ?? '-'}${reasons}`);
    }
  }
  if (report.feedback !== null) {
    const feedback = report.feedback;
    const probe = report.runs.find(run => run.probe === 'feedback');
    const confirmProblems = feedback.problems.filter(problem => problem.startsWith('X2'));
    const confirmResult = feedback.confirmRunId === null ? 'not run'
      : confirmProblems.length === 0 ? 'confirmed, action unchanged' : confirmProblems.join('; ');
    lines.push(
      '',
      '## Human-review feedback probe',
      '',
      `- Confirm: ${feedback.confirmFixtureId} run ${feedback.confirmRunId ?? 'not run'} — ${confirmResult}`,
      `- Override: ${feedback.overrideFixtureId} run ${feedback.overrideRunId ?? 'not run'} → ${feedback.overrideRemedyId} ${feedback.overrideAmountCents ?? 'n/a'} cents (server-computed eligible: ${feedback.expectedOverrideAmountCents ?? 'n/a'} cents)`,
      `- Probe run: ${probe === undefined ? 'not run' : `${probe.fixtureId} #${probe.attempt} ${probe.status} ${probe.passed ? 'PASS' : 'FAIL'}`} — precedent check: ${probe?.feedbackPrecedent?.detail ?? 'missing'}`,
      `- Problems: ${feedback.problems.length === 0 ? 'none' : feedback.problems.join('; ')}`,
      "- The override is a synthetic probe, recorded in the API's in-memory precedent store until restart; it is not a real decision."
    );
  }
  if (report.gate !== null) {
    lines.push('', '## Release gate', '', `Release gate: ${report.gate.passed ? 'PASS' : 'FAIL'}`, '');
    for (const item of report.gate.conditions) lines.push(`- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'} (${item.detail})`);
  }
  lines.push('');
  return lines.join('\n');
}
