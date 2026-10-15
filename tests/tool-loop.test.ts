import { describe, it, expect, vi } from 'vitest';
import { runAdvocateToolLoop, createMockEvidenceTools, defaultToolLoopConfig, EXECUTION_LIMITS } from '@fairtrip/agents';
import { validateCitations } from '@fairtrip/contracts';
import type { AdvocateCase, Evidence, PolicyClause } from '@fairtrip/contracts';
import { catalog } from '../apps/api/src/catalog.js';
import type { ModelAdapter } from '@fairtrip/agents';

const withCitationValidation = () => ({
  ...defaultToolLoopConfig(),
  validateFinalCase: (finalCase: AdvocateCase, evidence: Evidence[], policies: PolicyClause[]) =>
    validateCitations([finalCase], undefined, evidence, policies)
});

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
  it('allows two tool request rounds followed by a final case', async () => {
    const model = mockModel([
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}]}),
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_policy', input: {category: 'route_deviation'}}]}),
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})
    ]);
    const output = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(output.retrievedEvidence).toHaveLength(1);
    expect(output.retrievedPolicies).toHaveLength(1);
  });

  it('does not spend a tool round on the single directed output repair', async () => {
    const model = mockModel([
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}]}),
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_policy', input: {category: 'route_deviation'}}]}),
      'malformed final case',
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})
    ]);
    const output = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(output.case.side).toBe('rider');
    expect(output.retrievedPolicies).toHaveLength(1);
  });

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
    const model = mockModel(['not valid json', 'still not valid json', 'never valid json']);
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt')).rejects.toThrow('unparseable');
  });

  it('runs the first call thinking-off with the tight hedge, later calls with the configured thinking', async () => {
    const options: ({thinking?: string | undefined; hedgeAfterMs?: number | undefined} | undefined)[] = [];
    const responses = [
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}]}),
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})
    ];
    const model: ModelAdapter = {
      async complete(_messages, _signal, callOptions) {
        options.push(callOptions === undefined ? undefined : {thinking: callOptions.thinking, hedgeAfterMs: callOptions.hedgeAfterMs});
        const response = responses.shift();
        if (response === undefined) throw new Error('No more mock responses');
        return response;
      }
    };
    await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(options).toEqual([
      {thinking: 'off', hedgeAfterMs: EXECUTION_LIMITS.hedgeAfterMs.toolRequest},
      {thinking: 'default', hedgeAfterMs: EXECUTION_LIMITS.hedgeAfterMs.advocateCase}
    ]);
  });

  it('uses the configured thinking depth for post-tool calls', async () => {
    const options: ({thinking?: string | undefined; hedgeAfterMs?: number | undefined} | undefined)[] = [];
    const responses = [
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}]}),
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})
    ];
    const model: ModelAdapter = {
      async complete(_messages, _signal, callOptions) {
        options.push(callOptions === undefined ? undefined : {thinking: callOptions.thinking, hedgeAfterMs: callOptions.hedgeAfterMs});
        const response = responses.shift();
        if (response === undefined) throw new Error('No more mock responses');
        return response;
      }
    };
    await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt',
      {...defaultToolLoopConfig(), thinking: 'adaptive'});
    expect(options[1]?.thinking).toBe('adaptive');
  });

  it('accepts a case envelope missing type as final_case via normalisation, no repair spent', async () => {
    emitter.emit.mockClear();
    const model = mockModel([JSON.stringify({case: {...catalog.riderCase, side: 'rider'}})]);
    const result = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(result.case.side).toBe('rider');
    const types = emitter.emit.mock.calls.map(call => (call[0] as {type: string}).type);
    expect(types).toContain('output.normalised');
    expect(types).not.toContain('output.repair');
  });

  it('names the validation reason — invalid JSON or schema paths — in parse-repair diagnostics', async () => {
    emitter.emit.mockClear();
    const model = mockModel([
      'not valid json',
      JSON.stringify({type: 'final_case'}),
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})
    ]);
    const output = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(output.case.side).toBe('rider');
    const summaries = emitter.emit.mock.calls.map(call => String((call[0] as {summary: string}).summary));
    expect(summaries.some(summary => summary.includes('invalid JSON'))).toBe(true);
    expect(summaries.some(summary => summary.includes('schema:'))).toBe(true);
  });

  it('keeps raw model reasoning out of public parse-failure diagnostics', async () => {
    const model = mockModel(['<think>synthetic private reasoning</think>', '<think>synthetic private reasoning</think>', '<think>synthetic private reasoning</think>']);
    const failure = runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    await expect(failure).rejects.toThrow('unparseable output');
    await expect(failure).rejects.not.toThrow('synthetic private reasoning');
    await expect(failure).rejects.not.toThrow('<think>');
  });

  it('fails after exceeding max tool rounds', async () => {
    const model = mockModel([
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}]}),
      JSON.stringify({ type: 'tool_request', tools: [{ name: 'get_evidence', input: { sources: ['gps'] } }] }),
      JSON.stringify({ type: 'tool_request', tools: [{ name: 'get_evidence', input: { sources: ['chat'] } }] })
    ]);
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt', { maxRounds: 2, maxRepairAttempts: 1, modelTimeoutMs: 20000 })).rejects.toThrow('exceeded maximum tool rounds');
  });

  it('derives its default limits from EXECUTION_LIMITS', async () => {
    expect(EXECUTION_LIMITS).toMatchObject({
      toolRounds: 2, repairAttempts: 2, modelTimeoutMs: 95000, modelAttemptTimeoutMs: 45000, modelRetries: 1,
      networkRetries: 2, retryBackoffMs: [300, 1000],
      hedgeAfterMs: {toolRequest: 6000, advocateCase: 20000, judge: 20000},
      runDeadlineMs: 90000
    });
    // With the derived default, two malformed replies are repaired and the third call still succeeds.
    const model = mockModel(['bad output 1', 'bad output 2', JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider'}})]);
    const output = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt');
    expect(output.case.side).toBe('rider');
  });

  it('repairs a final case that cites an identifier no tool returned', async () => {
    const model = mockModel([
      JSON.stringify({type: 'tool_request', tools: [
        {name: 'get_evidence', input: {sources: ['gps']}},
        {name: 'get_policy', input: {category: 'route_deviation'}}
      ]}),
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider', arguments: [{claim: 'Invented policy', evidenceIds: [], policyClauseIds: ['GE-1']}]}}),
      // The repaired case cites only the ids the tool round actually returned.
      JSON.stringify({type: 'final_case', case: {...catalog.riderCase, side: 'rider', arguments: [{claim: 'GPS shows detour', evidenceIds: ['e-route-gps-1'], policyClauseIds: ['p-route-deviation-1']}]}})
    ]);
    const output = await runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt', withCitationValidation());
    expect(output.case.side).toBe('rider');
    expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'output.repair',
      summary: expect.stringContaining('citation')
    }));
  });

  it('fails with the citation error after exceeding repair attempts', async () => {
    const badCase = {...catalog.riderCase, side: 'rider' as const, arguments: [{claim: 'Invented policy', evidenceIds: [], policyClauseIds: ['GE-1']}]};
    const model = mockModel([
      JSON.stringify({type: 'tool_request', tools: [{name: 'get_policy', input: {category: 'route_deviation'}}]}),
      JSON.stringify({type: 'final_case', case: badCase}),
      JSON.stringify({type: 'final_case', case: badCase})
    ]);
    const config = {...withCitationValidation(), maxRepairAttempts: 1};
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt', config)).rejects.toThrow('Unknown policy citation: GE-1');
  });

  it('shares one repair budget between parse and citation repairs', async () => {
    const badCase = {...catalog.riderCase, side: 'rider' as const, arguments: [{claim: 'Invented policy', evidenceIds: [], policyClauseIds: ['GE-1']}]};
    const model = mockModel([
      'not valid json',
      JSON.stringify({type: 'final_case', case: badCase})
    ]);
    const config = {...withCitationValidation(), maxRepairAttempts: 1};
    await expect(runAdvocateToolLoop('rider', dispute, model, evidenceTools, emitter, signal(), 'test prompt', config)).rejects.toThrow('Unknown policy citation: GE-1');
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
