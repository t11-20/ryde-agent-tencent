import { describe, expect, it } from 'vitest';
import { computeMetrics, renderScorecard } from '../src/scorecard.js';
import type { EvalReport, RunResult } from '../src/report.js';

const ok = {ok: true, detail: 'ok'};
const run: RunResult = {
  fixtureId: 'R1', attempt: 1, runId: 'run-1', status: 'completed', remedyId: 'refund_route_excess', amountCents: 198,
  latencyMs: 1500, passed: false,
  checks: {statusMatch: ok, remedyMatch: ok, amountExact: {ok: false, detail: 'wrong'}, citationsValid: ok, traceComplete: ok, noReasoningLeak: ok, withinDeadline: ok},
  decisiveCoverage: 1, problem: null
};

function report(gate: EvalReport['gate']): EvalReport {
  return {startedAt: '2026-01-01T00:00:00.000Z', baseUrl: 'http://127.0.0.1:3001', outDir: 'out', runs: [run], metrics: computeMetrics([run]), gate};
}

describe('renderScorecard', () => {
  it('contains the per-run table, token usage line and failing checks', () => {
    const markdown = renderScorecard(report(null));
    expect(markdown).toContain('| Fixture | Attempt | Status | Remedy | Amount (cents) | Latency | Pass | Failing checks |');
    expect(markdown).toContain('Token usage: not measured');
    expect(markdown).toContain('amountExact');
    expect(markdown).toContain('http://127.0.0.1:3001');
    expect(markdown).not.toContain('Release gate');
  });

  it('shows Release gate: FAIL with each condition when the gate failed', () => {
    const markdown = renderScorecard(report({passed: false, conditions: [{name: 'golden-pass-once', ok: false, detail: 'N3: not run'}]}));
    expect(markdown).toContain('Release gate: FAIL');
    expect(markdown).toContain('golden-pass-once: FAIL (N3: not run)');
  });
});
