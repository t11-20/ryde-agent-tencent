import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { RunSchema, JudgeModelResponseSchema } from '@fairtrip/contracts';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
import type { ModelAdapter } from '@fairtrip/agents';
import { mockEvidenceStore, mockPolicyStore } from '@fairtrip/agents';

function buildStubLiveModel(queues: {rider: string[]; driver: string[]; judge: string[]}): ModelAdapter & {calls: Record<string, number>} {
  const calls: Record<string, number> = {rider: 0, driver: 0, judge: 0};
  const adapter: ModelAdapter & {calls: Record<string, number>} = {
    calls,
    async complete(messages, _signal) {
      const sys = messages.find(m => m.role === 'system')?.content ?? '';
      // The judge prompt mentions both sides by name, so we use the unique opening
      // line "You are the X" to route to the right response queue.
      const role = sys.startsWith('You are the Rider Advocate') ? 'rider'
        : sys.startsWith('You are the Driver Advocate') ? 'driver'
        : 'judge';
      calls[role] = (calls[role] ?? 0) + 1;
      const queue = queues[role];
      const next = queue.shift();
      if (next === undefined) throw new Error(`Live model ran out of stubbed responses for role=${role} after ${calls[role]} calls`);
      return next;
    }
  };
  return adapter;
}

const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'MiniMax-M3'});

// Lane A tests use its synthetic examples; no Lane B package is required.
const r1EvidenceIds = mockEvidenceStore['dispute-route-example']!.map(record => record.id);
const r1PolicyIds = mockPolicyStore.route_deviation!.map(clause => clause.id);
const riderCase = {
  side: 'rider' as const,
  summary: 'rider case summary',
  arguments: [{claim: 'rider claim', evidenceIds: [r1EvidenceIds[0]!], policyClauseIds: [r1PolicyIds[0]!]}],
  counterevidence: [],
  requestedRemedyId: 'keep_charge' as const,
  missingFacts: []
};
const driverCase = {
  side: 'driver' as const,
  summary: 'driver case summary',
  arguments: [{claim: 'driver claim', evidenceIds: [r1EvidenceIds[2]!], policyClauseIds: [r1PolicyIds[0]!]}],
  counterevidence: [],
  requestedRemedyId: 'keep_charge' as const,
  missingFacts: []
};

async function finished(api: ReturnType<typeof createApp>, id: string, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    const response = await request(api).get(`/api/runs/${id}`);
    if (response.body.status === 'completed' || response.body.status === 'failed' || response.body.status === 'incomplete') return response;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Live run did not complete in time');
}

describe('live mode wiring', () => {
  it('runs the tool loop with the model adapter for both advocates and the judge', async () => {
    const judgeResponse = JudgeModelResponseSchema.parse({
      ruling: 'driver_favored',
      findings: [{claim: 'No decisive evidence', evidenceIds: [], policyClauseIds: []}],
      remedyId: 'keep_charge',
      confidence: 0.5,
      reasoning: 'Test reasoning',
      riderExplanation: 'Test rider',
      driverExplanation: 'Test driver'
    });
    const model = buildStubLiveModel({
      rider: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps', 'chat']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: riderCase})
      ],
      driver: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['payment', 'history']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: driverCase})
      ],
      judge: [JSON.stringify(judgeResponse)]
    });

    const api = createApp(liveConfig, model);
    const health = await request(api).get('/api/health');
    expect(health.body.mode).toBe('live');
    expect(health.body.modelAccess).toBe('configured');

    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example', riderClaim: 'Live rider claim'});
    expect(started.status).toBe(202);
    const response = await finished(api, started.body.id);
    if (response.body.status === 'failed') {
      // Surface failure detail in the assertion message for fast debugging.
      throw new Error(`Run failed: ${JSON.stringify(response.body.error)}\nEvents: ${JSON.stringify(response.body.events.map((e: {type: string; actor: string}) => ({type: e.type, actor: e.actor})), null, 2)}`);
    }
    const run = RunSchema.parse(response.body);
    expect(run.status).toBe('completed');
    expect(run.mode).toBe('live');
    expect(run.dispute.riderClaim).toBe('Live rider claim');
    expect(run.cases).toHaveLength(2);
    expect(run.cases.map(c => c.side).sort()).toEqual(['driver', 'rider']);
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.result.remedyId).toBe('keep_charge');
    expect(run.result.action.recipient).toBe('none');
    expect(run.result.action.amountCents).toBe(0);
    expect(model.calls).toEqual({rider: 2, driver: 2, judge: 1});
    expect(run.retrievedEvidence).toHaveLength(4);
    expect(run.retrievedPolicies).toHaveLength(1);
    const eventTypes = run.events.map(e => e.type);
    expect(eventTypes).toContain('tool.requested');
    expect(eventTypes).toContain('evidence.retrieved');
    expect(eventTypes.filter(t => t === 'model.start').length).toBeGreaterThanOrEqual(2);
    expect(eventTypes.filter(t => t === 'case.completed')).toHaveLength(2);
    expect(eventTypes).toContain('judge.started');
    expect(eventTypes[eventTypes.length - 1]).toBe('run.completed');
  });

  it('fails after one directed repair when the judge response stays malformed', async () => {
    const model = buildStubLiveModel({
      rider: [JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps', 'chat', 'payment', 'history']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}), JSON.stringify({type: 'final_case', case: riderCase})],
      driver: [JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps', 'chat', 'payment', 'history']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}), JSON.stringify({type: 'final_case', case: driverCase})],
      judge: ['not valid json', 'still invalid']
    });
    const api = createApp(liveConfig, model);
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    const response = await finished(api, started.body.id);
    const run = RunSchema.parse(response.body);
    expect(run.status).toBe('failed');
    expect(model.calls.judge).toBe(2);
    expect(run.events.filter(event => event.actor === 'judge' && event.type === 'output.repair')).toHaveLength(1);
  });

  it('config validation rejects insecure or credential-bearing live base URLs', () => {
    expect(() => readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'http://example.com/v1', MODEL_NAME: 'm'})).toThrow('HTTPS');
    expect(() => readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://u:p@example.com/v1', MODEL_NAME: 'm'})).toThrow('HTTPS');
  });

  it('emits evidence retrieval events with the IDs actually fetched', async () => {
    const judgeResponse = JudgeModelResponseSchema.parse({
      ruling: 'incomplete',
      findings: [{claim: 'No decisive evidence', evidenceIds: [], policyClauseIds: []}],
      remedyId: 'keep_charge',
      confidence: 0.5,
      reasoning: 'Test reasoning',
      riderExplanation: 'Test rider',
      driverExplanation: 'Test driver'
    });
    const model = buildStubLiveModel({
      rider: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: riderCase})
      ],
      driver: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['payment']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: driverCase})
      ],
      judge: [JSON.stringify(judgeResponse)]
    });
    const api = createApp(liveConfig, model);
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    const response = await finished(api, started.body.id);
    if (response.body.status === 'failed') {
      throw new Error(`Run failed: ${JSON.stringify(response.body.error)}`);
    }
    const run = RunSchema.parse(response.body);
    expect(run.status).toBe('incomplete');
    expect(run).not.toHaveProperty('result');
    const retrievedEvents = run.events.filter(e => e.type === 'evidence.retrieved');
    expect(retrievedEvents.length).toBeGreaterThan(0);
    for (const event of retrievedEvents) expect(event.evidenceIds.length).toBeGreaterThan(0);
  });

  it('rejects citations to evidence fetched only by the other advocate', async () => {
    const model = buildStubLiveModel({
      rider: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: {...riderCase, arguments: [{claim: 'Unretrieved payment', evidenceIds: [r1EvidenceIds[2]!], policyClauseIds: [r1PolicyIds[0]!]}]}})
      ],
      driver: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['payment']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: driverCase})
      ],
      judge: []
    });
    const api = createApp(liveConfig, model);
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    const {body} = await finished(api, started.body.id);
    expect(body.status).toBe('failed');
    expect(body.error.message).toContain('Unknown evidence citation');
    expect(model.calls.judge).toBe(0);
    expect(body).not.toHaveProperty('result');
  });

  it('fails visibly on provider outage and never substitutes a stub outcome', async () => {
    const api = createApp(liveConfig, {async complete() {throw new Error('Model request failed (HTTP 503)');}});
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    const {body} = await finished(api, started.body.id);
    expect(body.status).toBe('failed');
    expect(body.error.message).toBe('Model request failed (HTTP 503)');
    expect(body.events.some((event: {type: string}) => event.type === 'judge.started')).toBe(false);
    expect(body).not.toHaveProperty('result');
  });

  it('gives the Judge both cases and only the union of actually retrieved sources', async () => {
    const judgeResponse = {
      ruling: 'driver_favored', findings: [], remedyId: 'keep_charge', confidence: 0.8,
      reasoning: 'Test decision', riderExplanation: 'Test rider', driverExplanation: 'Test driver'
    };
    const model = buildStubLiveModel({
      rider: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['gps']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: riderCase})
      ],
      driver: [
        JSON.stringify({type: 'tool_request', tools: [{name: 'get_evidence', input: {sources: ['payment']}}, {name: 'get_policy', input: {category: 'route_deviation'}}]}),
        JSON.stringify({type: 'final_case', case: driverCase})
      ],
      judge: [JSON.stringify(judgeResponse)]
    });
    let context: {cases: {side: string}[]; evidence: {id: string}[]; policies: {id: string}[]} | undefined;
    const complete = model.complete.bind(model);
    model.complete = async (messages, signal) => {
      if (messages[0]?.content.startsWith('You are the Judge')) context = JSON.parse(messages[1]!.content);
      return complete(messages, signal);
    };
    const api = createApp(liveConfig, model);
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    expect((await finished(api, started.body.id)).body.status).toBe('completed');
    expect(context?.cases.map(value => value.side).sort()).toEqual(['driver', 'rider']);
    expect(context?.evidence.map(value => value.id).sort()).toEqual([r1EvidenceIds[0]!, r1EvidenceIds[2]!].sort());
    expect(context?.policies.map(value => value.id)).toEqual([r1PolicyIds[0]!]);
  });

  it('requires each advocate to request policy instead of submitting a case immediately', async () => {
    const model = buildStubLiveModel({
      rider: [JSON.stringify({type: 'final_case', case: riderCase})],
      driver: [JSON.stringify({type: 'final_case', case: driverCase})],
      judge: []
    });
    const api = createApp(liveConfig, model);
    const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
    const {body} = await finished(api, started.body.id);
    expect(body.status).toBe('failed');
    expect(body.error.message).toContain('independently request evidence and policy');
    expect(model.calls.judge).toBe(0);
  });

  it('terminates at 90 seconds even when an adapter does not honor cancellation', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    try {
      const signals: AbortSignal[] = [];
      const api = createApp(liveConfig, {complete(_messages, signal) {
        signals.push(signal);
        return new Promise<string>(() => {});
      }});
      const started = await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example'});
      expect((await request(api).get(`/api/runs/${started.body.id}`)).body.status).toBe('running');
      await vi.advanceTimersByTimeAsync(90000);
      const {body} = await request(api).get(`/api/runs/${started.body.id}`);
      expect(body.status).toBe('failed');
      expect(body.error.message).toContain('deadline exceeded');
      expect(signals.every(signal => signal.aborted)).toBe(true);
      expect(body.events.at(-1).type).toBe('run.failed');
    } finally {
      vi.useRealTimers();
    }
  });
});
