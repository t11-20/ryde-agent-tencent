import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { RunSchema, type Run } from '@fairtrip/contracts';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { createScriptedModel } from './scripted-model.js';

const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted'});
const app = () => createApp(liveConfig, createScriptedModel(), createFixtureSource());

async function terminalRun(api: ReturnType<typeof app>, id: string): Promise<Run> {
  for (let poll = 0; poll < 400; poll++) {
    const response = await request(api).get(`/api/runs/${id}`);
    const status: unknown = response.body.status;
    if (status === 'completed' || status === 'failed' || status === 'incomplete') return RunSchema.parse(response.body);
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Run did not reach a terminal status within 400 polls');
}

async function runFixture(fixtureId: string, riderClaim?: string): Promise<Run> {
  const api = app();
  const started = await request(api).post('/api/runs').send(riderClaim === undefined ? {fixtureId} : {fixtureId, riderClaim});
  expect(started.status).toBe(202);
  return terminalRun(api, String(started.body.id));
}

describe('live API with the Lane B fixture source', () => {
  it('serves the Lane B fixture listing in live mode', async () => {
    const response = await request(app()).get('/api/fixtures');
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('live');
    expect(response.body.fixtures).toHaveLength(11);
    expect(response.body.fixtures[0].id).toBe('R1');
  });

  it('completes R1 through the real workflow with the Lane B refund amount', async () => {
    const run = await runFixture('R1');
    expect(run.status).toBe('completed');
    expect(run.fixtureId).toBe('R1');
    expect(run.dispute.id).toBe('DSP-R1');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.result.action.remedyId).toBe('refund_route_excess');
    expect(run.result.action.amountCents).toBe(198);
    expect(run.result.action.recipient).toBe('rider');
    const last = run.events[run.events.length - 1];
    expect(last?.type).toBe('run.completed');
    expect(last?.summary).toContain('SYNTHETIC fixtures');
  });

  it('marks X1 incomplete when decisive GPS evidence is unavailable', async () => {
    const run = await runFixture('X1');
    expect(run.status).toBe('incomplete');
    if (run.status !== 'incomplete') throw new Error('unreachable');
    expect(run.missingEvidence[0]?.startsWith('gps:')).toBe(true);
    const incomplete = run.events.find(event => event.type === 'run.incomplete');
    expect(incomplete?.summary.startsWith('Decisive evidence unavailable')).toBe(true);
  });

  it('accepts an edited rider claim for N2 and keeps the charge', async () => {
    const run = await runFixture('N2', 'Edited claim');
    expect(run.status).toBe('completed');
    expect(run.dispute.riderClaim).toBe('Edited claim');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.result.action.remedyId).toBe('keep_charge');
    expect(run.result.action.amountCents).toBe(0);
  });

  it('returns 404 for an unknown fixture in live mode', async () => {
    const response = await request(app()).post('/api/runs').send({fixtureId: 'NOPE'});
    expect(response.status).toBe(404);
  });

  it('keeps stub mode on the contract examples even when a source is passed', async () => {
    const api = createApp(readConfig({}), undefined, createFixtureSource());
    const response = await request(api).get('/api/fixtures');
    expect(response.body.mode).toBe('stub');
    expect(response.body.fixtures).toHaveLength(2);
    for (const fixture of response.body.fixtures) expect(fixture.kind).toBe('contract_example');
  });
});
