import { describe, expect, it } from 'vitest';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { Run } from '@fairtrip/contracts';
import { buildExport } from './export.js';
import { completedRun, sampleEvents } from './test-runs.js';

describe('buildExport — stretch fields', () => {
  it('carries risk, precedents, escalation and review into the exported run', () => {
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('expected completed run');
    const stretched: Run = {
      ...run,
      risk: {
        overall: 'high',
        signals: [{code: 'low_rating', party: 'driver', severity: 'medium', detail: 'Driver rating is 3.9.', evidenceIds: ['HIST-DRIVER']}],
        summary: 'Driver rating is low.',
        caveat: RISK_CAVEAT,
        source: 'model',
      },
      precedents: [{
        id: 'PREC-001', category: 'route_deviation', decidedAt: '2026-09-10T00:00:00.000Z', origin: 'seed',
        ruling: 'rider_favored', remedyId: 'refund_route_excess',
        features: ['rd1_exceeded', 'rider_objection'], summary: 'Synthetic precedent: detour exceeded the threshold with rider objection.',
      }],
      escalation: {reasons: ['high_risk'], confidence: 0.86, threshold: 0.8, summary: 'Escalated for human review (high risk).'},
      review: {decision: 'confirmed', decidedAt: '2026-10-02T14:00:00Z', note: 'Checked.', ruling: 'rider_favored', action: run.result.action},
    };
    const exported = JSON.parse(buildExport(stretched, sampleEvents, 'live')) as {run: Record<string, unknown>};
    expect(exported.run['risk']).toBeDefined();
    expect(exported.run['precedents']).toBeDefined();
    expect(exported.run['escalation']).toBeDefined();
    expect(exported.run['review']).toBeDefined();
  });

  it('carries the policy verdict, divergence and retry links into the exported run', () => {
    const run = completedRun();
    if (run.status !== 'completed') throw new Error('expected completed run');
    const stretched: Run = {
      ...run,
      verdict: {outcome: 'keep_charge', clauseIds: ['RD-1', 'RD-4'], basis: 'the reroute was documented', features: ['rd1_exceeded', 'documented_reroute'], missingFamilies: []},
      divergence: {judgeRemedyId: 'refund_route_excess', verdictOutcome: 'keep_charge', summary: 'x'},
      escalation: {reasons: ['policy_divergence'], confidence: 0.86, threshold: 0.8, summary: 'x'},
    };
    const retried: Run = {...stretched, retryOf: 'run-0'};
    const exported = JSON.parse(buildExport(retried, sampleEvents, 'live')) as {run: Record<string, unknown>};
    expect(exported.run['verdict']).toBeDefined();
    expect(exported.run['divergence']).toBeDefined();
    expect(exported.run['retryOf']).toBe('run-0');
    const failed = JSON.parse(buildExport({...stretched, status: 'failed', error: {code: 'WORKFLOW_FAILED', message: 'x'}, retriedBy: 'run-9'}, sampleEvents, 'live')) as {run: Record<string, unknown>};
    expect(failed.run['retriedBy']).toBe('run-9');
  });
});
