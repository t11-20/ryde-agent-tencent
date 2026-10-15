import { describe, it, expect, vi } from 'vitest';
import { runRiskAnalyst } from '@fairtrip/agents';
import type { ModelAdapter } from '@fairtrip/agents';
import { RISK_CAVEAT } from '@fairtrip/contracts';
import type { RiskAssessment } from '@fairtrip/contracts';
import { catalog } from '../apps/api/src/catalog.js';

const dispute = catalog.disputes[0]!;
const signal = () => new AbortController().signal;

const deterministic: RiskAssessment = {
  overall: 'medium',
  signals: [{
    code: 'low_rating', party: 'driver', severity: 'medium',
    detail: 'Driver rating is below the review threshold.', evidenceIds: ['e-hist'],
  }],
  summary: 'Deterministic summary.',
  caveat: RISK_CAVEAT,
  source: 'deterministic',
};

function fakeModel(replies: string[]): {model: ModelAdapter; calls: number[]} {
  const calls: number[] = [];
  const model: ModelAdapter = {
    complete: async () => {
      calls.push(1);
      return replies.length > 0 ? replies.shift()! : '{}';
    },
  };
  return {model, calls};
}

describe('runRiskAnalyst', () => {
  it('replaces only the summary and marks the source as model on valid output', async () => {
    const {model} = fakeModel(['{"summary": "A neutral model-written summary."}']);
    const result = await runRiskAnalyst(dispute, deterministic, catalog.evidence, model, signal());
    expect(result.source).toBe('model');
    expect(result.summary).toBe('A neutral model-written summary.');
    expect(result.signals).toEqual(deterministic.signals);
    expect(result.overall).toBe(deterministic.overall);
  });

  it('falls back to the deterministic assessment after exhausting repair attempts', async () => {
    const {model, calls} = fakeModel(['not json at all', 'still not {valid', 'never valid']);
    const result = await runRiskAnalyst(dispute, deterministic, catalog.evidence, model, signal());
    expect(calls).toHaveLength(3);
    expect(result).toEqual(deterministic);
  });

  it('rejects think-block summaries and accepts the repaired attempt', async () => {
    // unpaired marker survives extractJsonText and lands inside the parsed summary
    const {model} = fakeModel(['{"summary": "prefix <think> suffix"}', '{"summary": "Clean summary."}']);
    const result = await runRiskAnalyst(dispute, deterministic, catalog.evidence, model, signal());
    expect(result.summary).toBe('Clean summary.');
    expect(result.source).toBe('model');
  });

  it('falls back to the deterministic assessment when the model call rejects', async () => {
    const failing: ModelAdapter = {complete: async () => { throw new Error('provider unavailable'); }};
    const result = await runRiskAnalyst(dispute, deterministic, catalog.evidence, failing, signal());
    expect(result).toEqual(deterministic);
  });

  it('retries once after a provider error and accepts the next valid reply', async () => {
    let calls = 0;
    const model: ModelAdapter = {complete: async () => {
      calls += 1;
      if (calls === 1) throw new Error('provider unavailable');
      return '{"summary": "Recovered summary."}';
    }};
    const result = await runRiskAnalyst(dispute, deterministic, catalog.evidence, model, signal());
    expect(calls).toBe(2);
    expect(result.source).toBe('model');
    expect(result.summary).toBe('Recovered summary.');
  });

  it('propagates an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const model: ModelAdapter = {complete: vi.fn(async () => '{"summary": "x"}')};
    await expect(runRiskAnalyst(dispute, deterministic, catalog.evidence, model, controller.signal)).rejects.toThrow();
  });
});
