import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { RunSchema } from '@fairtrip/contracts';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
const app = () => createApp(readConfig({}));
async function finished(api: ReturnType<typeof app>, id: string) {
  for (let i = 0; i < 30; i++) {
    const response = await request(api).get(`/api/runs/${id}`);
    if (response.body.status === 'completed' || response.body.status === 'failed') return response;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Stub failed to complete');
}
describe('prerequisite API', () => {
  it('runs offline, labels examples, and completes both categories without real retrieval events', async () => {
    const api = app();
    const health = await request(api).get('/api/health');
    expect(health.body.mode).toBe('stub');
    expect(health.body.contractVersion).toBe('0.2.0');
    const list = await request(api).get('/api/fixtures');
    expect(list.status).toBe(200); expect(list.body.fixtures).toHaveLength(2);
    for (const fixture of list.body.fixtures) {
      expect(fixture.kind).toBe('contract_example');
      const started = await request(api).post('/api/runs').send({fixtureId: fixture.id, riderClaim: 'Edited placeholder claim'});
      expect(started.status).toBe(202);
      const response = await finished(api, started.body.id);
      const run = RunSchema.parse(response.body);
      expect(run.status).toBe('completed'); expect(run.mode).toBe('stub');
      expect(run.dispute.riderClaim).toBe('Edited placeholder claim');
      expect(run.retrievedEvidence).toEqual([]);
      expect(run.retrievedPolicies).toEqual([]);
      const eventTypes = run.events.map(e => e.type);
      expect(eventTypes[0]).toBe('run.started');
      expect(eventTypes[eventTypes.length - 1]).toBe('run.completed');
      expect(eventTypes.filter(t => t === 'model.start')).toHaveLength(3);
      expect(eventTypes.filter(t => t === 'model.finish')).toHaveLength(3);
      expect(eventTypes.filter(t => t === 'case.completed')).toHaveLength(2);
      expect(eventTypes).toContain('judge.started');
      const polled = await request(api).get(`/api/runs/${run.id}?after=2`);
      expect(polled.body.events.map((e: {sequence: number}) => e.sequence)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect((await request(api).get(`/api/runs/${run.id}?after=11`)).body.events).toEqual([]);
    }
  });
  it('isolates concurrent runs', async () => {
    const api = app();
    const starts = await Promise.all(['claim A', 'claim B'].map(riderClaim => request(api).post('/api/runs').send({fixtureId: 'dispute-route-example', riderClaim})));
    expect(starts[0]!.body.id).not.toBe(starts[1]!.body.id);
    const results = await Promise.all(starts.map(start => finished(api, start.body.id)));
    expect(results.map(r => r.body.dispute.riderClaim)).toEqual(['claim A', 'claim B']);
    for (const result of results) expect(result.body.events.every((e: {runId: string}) => e.runId === result.body.id)).toBe(true);
  });
  it('rejects invalid inputs, unknown IDs, malformed JSON and invalid cursors', async () => {
    const api = app();
    expect((await request(api).post('/api/runs').send({})).status).toBe(400);
    expect((await request(api).post('/api/runs').send({fixtureId: 'dispute-route-example', riderClaim: ''})).status).toBe(400);
    expect((await request(api).post('/api/runs').send({fixtureId: 'unknown'})).status).toBe(404);
    expect((await request(api).get('/api/runs/unknown')).status).toBe(404);
    for (const cursor of ['-1', '1.5', 'NaN', '9007199254740992', '1&after=2']) expect((await request(api).get(`/api/runs/unknown?after=${cursor}`)).status).toBe(400);
    expect((await request(api).post('/api/runs').set('Content-Type', 'application/json').send('{')).status).toBe(400);
  });
  it('never silently enables a live dispute runner', () => {
    expect(() => createApp(readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'model'}))).toThrow('not implemented');
  });
});
