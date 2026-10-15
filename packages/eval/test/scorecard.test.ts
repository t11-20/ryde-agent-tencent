import { describe, expect, it } from 'vitest';
import { computeMetrics, renderScorecard } from '../src/scorecard.js';
import type { EvalReport, FeedbackProbe, RunResult } from '../src/report.js';

const ok = {ok: true, detail: 'ok'};
const run: RunResult = {
  fixtureId: 'R1', attempt: 1, runId: 'run-1', status: 'completed', remedyId: 'refund_route_excess', amountCents: 198,
  latencyMs: 1500, passed: false,
  checks: {statusMatch: ok, remedyMatch: ok, amountExact: {ok: false, detail: 'wrong'}, citationsValid: ok, traceComplete: ok, noReasoningLeak: ok, withinDeadline: ok, riskSignalsIntact: ok, contextOnly: ok, verdictMatch: ok},
  decisiveCoverage: 1, problem: null, escalated: false, riskOverall: 'low',
  failureClass: 'outcome_mismatch', roleLatencySec: {rider: 10.5, driver: 10.5, judge: 8.2},
  escalationReasons: [], divergent: false, undetermined: false, retried: false, wallMs: 1500,
  modelStats: {callSec: {toolRequest: [], case: [], judge: [], risk: []}, directedRepairs: 0, normalisations: 0, callRetries: 0, hedgesFired: 0, hedgesWon: 0}
};

function report(gate: EvalReport['gate'], feedback: EvalReport['feedback'] = null, runs: RunResult[] = [run]): EvalReport {
  return {startedAt: '2026-01-01T00:00:00.000Z', baseUrl: 'http://127.0.0.1:3001', outDir: 'out', runs, metrics: computeMetrics(runs, feedback), gate, feedback};
}

describe('renderScorecard', () => {
  it('contains the per-run table, token usage line and failing checks', () => {
    const markdown = renderScorecard(report(null));
    expect(markdown).toContain('| Fixture | Attempt | Status | Remedy | Amount (cents) | Risk | Escalated | Latency | Pass | Failure class | Failing checks |');
    expect(markdown).toContain('| outcome_mismatch | amountExact |');
    expect(markdown).toContain('- Failure classes: outcome_mismatch 1');
    expect(markdown).toContain('- Model time per role (whole loop, s): rider p50 10.5 / max 10.5 · driver p50 10.5 / max 10.5 · risk p50 n/a / max n/a · judge p50 8.2 / max 8.2');
    expect(markdown).toContain('Provider-side classes (provider_timeout, provider_network) indicate model-endpoint latency or connectivity, not a system decision error.');
    expect(markdown).toContain('- Policy verdict: 1 / 1 finalised rulings equal the deterministic verdict; divergences escalated: 0; undetermined: 0');
    expect(markdown).toContain('- Automatic re-runs after a failed first attempt: 0');
    expect(markdown).toContain('A finalised payment can never differ from the deterministic policy verdict; disagreements are escalated for human review (policy-verdict-authoritative).');
    expect(markdown).toContain('Token usage: not measured');
    expect(markdown).toContain('amountExact');
    expect(markdown).toContain('http://127.0.0.1:3001');
    expect(markdown).not.toContain('Release gate');
  });

  it('aggregates failure classes and per-role latency across runs', () => {
    const a: RunResult = {...run, failureClass: 'provider_timeout', roleLatencySec: {rider: 10}};
    const b: RunResult = {...run, fixtureId: 'R2', failureClass: 'provider_timeout', roleLatencySec: {rider: 20, risk: 5}};
    const c: RunResult = {...run, fixtureId: 'N1', passed: true, failureClass: null, roleLatencySec: {rider: 30}};
    const metrics = computeMetrics([a, b, c]);
    expect(metrics.failureClasses.provider_timeout).toBe(2);
    expect(metrics.failureClasses.model_output).toBe(0);
    expect(metrics.roleLatency.rider).toEqual({p50: 20, max: 30});
    expect(metrics.roleLatency.risk).toEqual({p50: 5, max: 5});
    expect(metrics.roleLatency.judge).toEqual({p50: null, max: null});
    const markdown = renderScorecard(report(null, null, [a, b, c]));
    expect(markdown).toContain('- Failure classes: provider_timeout 2');
    expect(markdown).toContain('rider p50 20.0 / max 30.0');
    expect(markdown).toContain('judge p50 n/a / max n/a');
  });

  it('shows none for failure classes when every run passed and leaves the column empty', () => {
    const passing: RunResult = {...run, passed: true, checks: {...run.checks, amountExact: ok}, failureClass: null};
    const markdown = renderScorecard(report(null, null, [passing]));
    expect(markdown).toContain('- Failure classes: none');
    expect(markdown).toContain('| PASS |  |');
  });

  it('shows Release gate: FAIL with each condition when the gate failed', () => {
    const markdown = renderScorecard(report({passed: false, conditions: [{name: 'golden-pass-once', ok: false, detail: 'N3: not run'}]}));
    expect(markdown).toContain('Release gate: FAIL');
    expect(markdown).toContain('golden-pass-once: FAIL (N3: not run)');
  });

  it('reports the feedback probe as not run when there is no probe', () => {
    const markdown = renderScorecard(report(null));
    expect(markdown).toContain('- Human-review feedback probe: not run');
    expect(markdown).not.toContain('## Human-review feedback probe');
  });

  it('renders escalated runs with unchanged outcomes and the probe sections', () => {
    const escalatedRun: RunResult = {
      ...run, fixtureId: 'N2H', attempt: 1, runId: 'run-N2H-1', remedyId: 'keep_charge', amountCents: 0,
      passed: true, checks: {...run.checks, amountExact: ok}, escalated: true, riskOverall: 'high',
      escalationReasons: ['high_risk'], failureClass: null
    };
    const probe: RunResult = {
      ...run, fixtureId: 'N2', attempt: 4, runId: 'run-N2-4', remedyId: 'keep_charge', amountCents: 0,
      passed: true, checks: {...run.checks, amountExact: ok}, probe: 'feedback',
      feedbackPrecedent: {ok: true, detail: 'ok'}
    };
    const feedback: FeedbackProbe = {
      confirmFixtureId: 'X2', confirmRunId: 'run-X2-1',
      overrideFixtureId: 'N2H', overrideRunId: 'run-N2H-1', overrideRemedyId: 'refund_no_show_fee',
      overrideAmountCents: 500, expectedOverrideAmountCents: 500, problems: []
    };
    const markdown = renderScorecard(report(null, feedback, [escalatedRun, probe]));
    expect(markdown).toContain('- Escalated runs: 1 (outcome unchanged: 1)');
    expect(markdown).toContain('- Human-review feedback probe: pass');
    expect(markdown).toContain('## Escalated runs');
    expect(markdown).toContain('- N2H #1 — risk high — keep_charge 0 — high_risk');
    expect(markdown).toContain('- Policy verdict: 1 / 1 finalised rulings equal the deterministic verdict; divergences escalated: 0; undetermined: 0');
    expect(markdown).toContain('## Human-review feedback probe');
    expect(markdown).toContain('- Confirm: X2 run run-X2-1 — confirmed, action unchanged');
    expect(markdown).toContain('- Override: N2H run run-N2H-1 → refund_no_show_fee 500 cents (server-computed eligible: 500 cents)');
    expect(markdown).toContain('precedent check: ok');
    expect(markdown).toContain('| N2 (feedback probe) | 4 |');
    expect(markdown).toContain('synthetic probe');
  });

  it('marks re-runs in the table and reports wall time and verdict counters', () => {
    const escalatedDivergent: RunResult = {
      ...run, fixtureId: 'R3', runId: 'run-r3', passed: true, checks: {...run.checks, amountExact: ok},
      escalated: true, divergent: true, escalationReasons: ['policy_divergence'], failureClass: null
    };
    const retried: RunResult = {
      ...run, fixtureId: 'N1R', runId: 'run-n1r-2', passed: true, checks: {...run.checks, amountExact: ok},
      failureClass: null, retried: true, latencyMs: 2000, wallMs: 45000
    };
    const metrics = computeMetrics([escalatedDivergent, retried]);
    expect(metrics.providerRetries).toBe(1);
    expect(metrics.divergentRuns).toBe(1);
    expect(metrics.verdictAgree).toBe(1);
    const markdown = renderScorecard(report(null, null, [escalatedDivergent, retried]));
    expect(markdown).toContain('| N1R (re-run) |');
    expect(markdown).toContain('2.0 s (wall 45.0 s)');
    expect(markdown).toContain('- Automatic re-runs after a failed first attempt: 1');
    expect(markdown).toContain('divergences escalated: 1; undetermined: 0');
    expect(markdown).toContain('- R3 #1 — risk low — refund_route_excess 198 — policy_divergence');
  });

  it('marks the probe failed when it recorded problems', () => {
    const feedback: FeedbackProbe = {
      confirmFixtureId: 'X2', confirmRunId: null,
      overrideFixtureId: 'N2H', overrideRunId: null, overrideRemedyId: 'refund_no_show_fee',
      overrideAmountCents: null, expectedOverrideAmountCents: 500, problems: ['X2 #1 not escalated/completed']
    };
    const markdown = renderScorecard(report(null, feedback));
    expect(markdown).toContain('- Human-review feedback probe: fail');
    expect(markdown).toContain('X2 #1 not escalated/completed');
  });
});
