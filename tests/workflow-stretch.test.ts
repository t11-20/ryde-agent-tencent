import { describe, it, expect, vi } from 'vitest';
import { runWorkflow } from '@fairtrip/agents';
import type { JudgeContext, WorkflowEvent } from '@fairtrip/agents';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { Precedent } from '@fairtrip/contracts';
import { catalog } from '../apps/api/src/catalog.js';

const signal = () => new AbortController().signal;

const dispute = catalog.disputes[0]!;

const riskValue = {
  overall: 'medium',
  signals: [{
    code: 'low_rating', party: 'driver', severity: 'medium',
    detail: 'Driver rating is below the review threshold.', evidenceIds: ['e-hist'],
  }],
  summary: 'One driver signal.',
  caveat: RISK_CAVEAT,
  source: 'deterministic',
} as const;

const precedent: Precedent = {
  id: 'PREC-T1', category: dispute.category, decidedAt: '2026-09-01T00:00:00.000Z',
  origin: 'seed', ruling: 'driver_favored', remedyId: 'keep_charge',
  features: ['rd1_exceeded'], summary: 'Synthetic precedent: a test precedent.',
};

function emitter() {
  const events: WorkflowEvent[] = [];
  return {events, emit: {emit: (event: WorkflowEvent) => { events.push(event); }}};
}

const advocates = async (side: 'rider' | 'driver') => side === 'rider' ? catalog.riderCase : catalog.driverCase;

describe('runWorkflow — risk analyst and precedents', () => {
  it('runs the risk role in parallel, emits risk and precedent events, and passes context to the Judge', async () => {
    const {events, emit} = emitter();
    let seenContext: JudgeContext | undefined;
    const adjudicate = vi.fn(async (_cases: unknown, _dispute: unknown, _signal: AbortSignal, context: JudgeContext) => {
      seenContext = context;
      return catalog.judgeResult;
    });
    const result = await runWorkflow(dispute, {
      advocate: advocates,
      judge: adjudicate,
      risk: async () => structuredClone(riskValue),
    }, catalog.evidence, catalog.policies, signal(), emit, {precedents: [precedent]});

    const riskStart = events.findIndex(e => e.actor === 'risk' && e.type === 'model.start');
    const judgeStart = events.findIndex(e => e.type === 'judge.started');
    expect(riskStart).toBeGreaterThanOrEqual(0);
    expect(judgeStart).toBeGreaterThan(riskStart);

    const assessed = events.filter(e => e.type === 'risk.assessed');
    expect(assessed).toHaveLength(1);
    expect(assessed[0]?.evidenceIds).toEqual(['e-hist']);

    const retrieved = events.filter(e => e.type === 'precedent.retrieved');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]?.summary).toContain('PREC-T1');
    expect(retrieved[0]?.actor).toBe('precedent');

    expect(seenContext?.precedents).toEqual([precedent]);
    expect(seenContext?.risk).toEqual(riskValue);
    expect(result.risk).toEqual(riskValue);
  });

  it('completes the run without risk when the risk role fails, leaving the advocates unaffected', async () => {
    const {events, emit} = emitter();
    const result = await runWorkflow(dispute, {
      advocate: advocates,
      judge: async () => catalog.judgeResult,
      risk: async () => { throw new Error('risk model unavailable'); },
    }, catalog.evidence, catalog.policies, signal(), emit);

    expect('risk' in result).toBe(false);
    const assessed = events.filter(e => e.type === 'risk.assessed');
    expect(assessed).toHaveLength(1);
    expect(assessed[0]?.summary).toContain('unavailable');
    expect(events.filter(e => e.type === 'case.completed')).toHaveLength(2);
    expect(events.some(e => e.type === 'judge.started')).toBe(true);
  });

  it('emits no risk events and a no-match precedent event when no risk role is provided', async () => {
    const {events, emit} = emitter();
    await runWorkflow(dispute, {
      advocate: advocates,
      judge: async () => catalog.judgeResult,
    }, catalog.evidence, catalog.policies, signal(), emit);

    expect(events.some(e => e.actor === 'risk')).toBe(false);
    const retrieved = events.filter(e => e.type === 'precedent.retrieved');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]?.summary).toContain('No similar past ruling found');
  });
});
