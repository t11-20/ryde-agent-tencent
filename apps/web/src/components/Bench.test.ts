import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { Run } from '@fairtrip/contracts';
import { buildViewModel } from '../lib/view-model.js';
import { completedRun } from '../lib/test-runs.js';
import { Bench } from './Bench.js';

function benchProps(run: Run, overrides: Record<string, unknown> = {}) {
  const vm = buildViewModel(run, run.events);
  return {
    page: 'completed' as const,
    phase: 'done' as const,
    vm,
    run,
    problem: null,
    elapsedSeconds: 10,
    events: run.events,
    retriedNote: null,
    reviewBusy: false,
    reviewError: null,
    onRunAgain: () => undefined,
    onKeepWaiting: () => undefined,
    onStop: () => undefined,
    onExport: () => undefined,
    onConfirm: () => undefined,
    onOverride: () => undefined,
    ...overrides,
  };
}

const divergentRun = (): Run => {
  const run = completedRun();
  if (run.status !== 'completed') throw new Error('unreachable');
  return {
    ...run,
    verdict: {outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-4'], basis: 'the reroute was documented', features: ['rd1_exceeded', 'documented_reroute'], missingFamilies: []},
    divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge', summary: 'x'},
    escalation: {reasons: ['policy_divergence'], confidence: 0.86, threshold: 0.8, summary: 'x'},
  };
};

describe('Bench review state', () => {
  it('shows the divergence comparison and an Apply policy verdict button', () => {
    const html = renderToStaticMarkup(createElement(Bench, benchProps(divergentRun())));
    expect(html).toContain('Sent to human review — Judge disagrees with the policy rules');
    expect(html).toContain('Policy rules: Keep the charge (no refund) (RD-1, RD-4)');
    expect(html).toContain('Judge: Refund the excess-distance charge · confidence 86%');
    expect(html).toContain('Apply policy verdict');
    expect(html).toContain('Confirm ruling');
  });

  it('keeps the plain headline and hides the verdict button when the Judge agrees', () => {
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('unreachable');
    const escalated: Run = {
      ...run,
      verdict: {outcome: 'refund_route_excess', clauseIds: ['RD-1', 'RD-2'], basis: 'unjustified material detour', features: ['rd1_exceeded'], missingFamilies: []},
      escalation: {reasons: ['high_risk'], confidence: 0.86, threshold: 0.8, summary: 'x'},
      risk: {overall: 'high', signals: [], summary: 'High.', caveat: RISK_CAVEAT, source: 'model'},
    };
    const html = renderToStaticMarkup(createElement(Bench, benchProps(escalated)));
    expect(html).toContain('Sent to human review');
    expect(html).not.toContain('Judge disagrees with the policy rules');
    expect(html).not.toContain('Apply policy verdict');
  });

  it('shows the automatic re-run note when present', () => {
    const html = renderToStaticMarkup(createElement(Bench, benchProps(completedRun(), {retriedNote: 'First attempt failed (provider timeout); this is the automatic re-run.'})));
    expect(html).toContain('First attempt failed (provider timeout); this is the automatic re-run.');
  });
});
