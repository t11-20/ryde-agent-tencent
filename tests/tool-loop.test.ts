import { describe, it, expect, vi } from 'vitest';
import { runAdvocateToolLoop, createMockEvidenceTools } from '@fairtrip/agents';
import { catalog } from '../apps/api/src/catalog.js';
import type { ModelAdapter } from '@fairtrip/agents';

const mockModel = (responses: string[]): ModelAdapter => ({
  async complete(_messages, _signal) {
    const response = responses.shift();
    if (!response) throw new Error('No more mock responses');
    return response;
  }
});

const dispute = catalog.disputes[0]!;
const evidenceTools = createMockEvidenceTools(dispute);
const emitter = { emit: vi.fn() };
const signal = () => new AbortController().signal;

describe('advocate tool loop', () => {
  it('completes in one round when model returns final_case immediately', async () => {
    const model = mockModel([JSON.stringify({
      type: 'final_case',
      case: { ...catalog.riderCase, side: 'rider' }
    })]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(result.case.side).toBe('rider');
    expect(emitter.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool.requested' }));
  });

  it('executes tool requests and feeds results back for a second round', async () => {
    const model = mockModel([
      JSON.stringify({
        type: 'tool_request',
        tools: [{ name: 'get_evidence', input: { sources: ['gps'] } }]
      }),
      JSON.stringify({
        type: 'final_case',
        case: { ...catalog.riderCase, side: 'rider', arguments: [{ claim: 'GPS shows detour', evidenceIds: ['e-route-gps-1'], policyClauseIds: ['p-route-deviation-1'] }] }
      })
    ]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(result.case.side).toBe('rider');
    expect(result.retrievedEvidence.length).toBeGreaterThan(0);
    expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool.requested' }));
    expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'evidence.retrieved' }));
  });

  it('requests policy and tracks retrieved policies', async () => {
    const model = mockModel([
      JSON.stringify({
        type: 'tool_request',
        tools: [{ name: 'get_policy', input: { category: 'route_deviation' } }]
      }),
      JSON.stringify({
        type: 'final_case',
        case: { ...catalog.riderCase, side: 'rider' }
      })
    ]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(result.retrievedPolicies.length).toBeGreaterThan(0);
    expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'policy.retrieved' }));
  });

  it('rejects wrong-side advocate output', async () => {
    const model = mockModel([JSON.stringify({
      type: 'final_case',
      case: { ...catalog.driverCase, side: 'driver' }
    })]);
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt')).rejects.toThrow('wrong side');
  });

  it('attempts repair once for malformed JSON', async () => {
    const model = mockModel([
      'not valid json',
      JSON.stringify({
        type: 'final_case',
        case: { ...catalog.riderCase, side: 'rider' }
      })
    ]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(result.case.side).toBe('rider');
    expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'output.repair' }));
  });

  it('fails after exceeding repair attempts', async () => {
    const model = mockModel(['not valid json', 'still not valid json']);
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt')).rejects.toThrow('unparseable');
  });

  it('fails after exceeding max tool rounds', async () => {
    const model = mockModel([
      JSON.stringify({ type: 'tool_request', tools: [{ name: 'get_evidence', input: { sources: ['gps'] } }] }),
      JSON.stringify({ type: 'tool_request', tools: [{ name: 'get_evidence', input: { sources: ['chat'] } }] })
    ]);
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt', { maxRounds: 2, maxRepairAttempts: 1, modelTimeoutMs: 20000 })).rejects.toThrow('exceeded maximum tool rounds');
  });

  it('deduplicates retrieved evidence across multiple requests', async () => {
    const model = mockModel([
      JSON.stringify({
        type: 'tool_request',
        tools: [
          { name: 'get_evidence', input: { sources: ['gps'] } },
          { name: 'get_evidence', input: { sources: ['gps', 'chat'] } }
        ]
      }),
      JSON.stringify({
        type: 'final_case',
        case: { ...catalog.riderCase, side: 'rider' }
      })
    ]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    // Should not duplicate the GPS evidence
    const gpsIds = result.retrievedEvidence.filter(e => e.source === 'gps').map(e => e.id);
    expect(new Set(gpsIds).size).toBe(gpsIds.length);
  });
});
