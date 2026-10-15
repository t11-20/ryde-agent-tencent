import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { RunSchema, type Run } from '@fairtrip/contracts';
import { createFixtureSource } from '@fairtrip/evidence';
import type { ModelAdapter } from '@fairtrip/agents';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig, type Config } from '../../apps/api/src/config.js';
import { createScriptedModel } from './scripted-model.js';

const liveConfig = (extra: Record<string, string> = {}): Config =>
  readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted', ...extra});
const app = (config: Config = liveConfig(), model?: ModelAdapter) => createApp(config, model ?? createScriptedModel(), createFixtureSource());

async function terminalRun(api: ReturnType<typeof app>, id: string): Promise<Run> {
  for (let poll = 0; poll < 400; poll++) {
    const response = await request(api).get(`/api/runs/${id}`);
    const status: unknown = response.body.status;
    if (status === 'completed' || status === 'failed' || status === 'incomplete') return RunSchema.parse(response.body);
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Run did not reach a terminal status within 400 polls');
}

async function runFixture(api: ReturnType<typeof app>, fixtureId: string): Promise<Run> {
  const started = await request(api).post('/api/runs').send({fixtureId});
  expect(started.status).toBe(202);
  return terminalRun(api, String(started.body.id));
}

const basisSchema = z.array(z.object({remedyId: z.string(), eligibleCents: z.number().int().nullable()}));

function eligibleCentsFor(run: Run, remedyId: string): number {
  const record = run.retrievedEvidence.find(item => item.id === 'PAY-REMEDY');
  if (record === undefined) throw new Error('PAY-REMEDY record not retrieved');
  const basis = basisSchema.parse(z.object({basis: z.unknown()}).parse(record.facts).basis);
  const entry = basis.find(item => item.remedyId === remedyId);
  if (entry === undefined || entry.eligibleCents === null) throw new Error(`No eligible amount for ${remedyId}`);
  return entry.eligibleCents;
}

describe('live API stretch goals', () => {
  it('runs the risk analyst, reports risk on the run and escalates high risk', async () => {
    const api = app();
    const run = await runFixture(api, 'N2H');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.risk?.overall).toBe('high');
    expect(run.risk?.source).toBe('model');
    expect(run.escalation?.reasons).toContain('high_risk');
    const types = run.events.map(e => e.type);
    expect(types).toContain('risk.assessed');
    expect(types).toContain('precedent.retrieved');
    expect(types).toContain('run.escalated');
    expect(run.events[run.events.length - 2]?.type).toBe('run.escalated');
    expect(run.events[run.events.length - 1]?.type).toBe('run.completed');
    const riskStart = run.events.findIndex(e => e.type === 'model.start' && e.actor === 'risk');
    const judgeStarted = run.events.findIndex(e => e.type === 'judge.started');
    expect(riskStart).toBeGreaterThanOrEqual(0);
    expect(judgeStarted).toBeGreaterThanOrEqual(0);
    expect(riskStart).toBeLessThan(judgeStarted);
    expect(run.result.action.remedyId).toBe('keep_charge');
    expect(run.result.action.amountCents).toBe(0);
  });

  it('matches precedents, appends a run precedent and reuses it on a later run', async () => {
    const api = app();
    const before = (await request(api).get('/api/precedents')).body.count;
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation).toBeUndefined();
    expect(run.precedents?.[0]?.id).toBe('PREC-001');

    const listing = await request(api).get('/api/precedents');
    expect(listing.body.count).toBe(before + 1);
    const appended = listing.body.precedents.find((p: {origin: string; runId?: string}) => p.runId === run.id);
    expect(appended?.origin).toBe('run');

    const second = await runFixture(api, 'R1');
    expect(second.precedents?.some(p => p.runId === run.id)).toBe(true);
  });

  it('applies a confirmed review to an escalated run and rejects a repeat', async () => {
    const api = app();
    const run = await runFixture(api, 'N2H');
    expect(run.status).toBe('completed');
    const reviewed = await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'confirmed', note: 'Checked it.'});
    expect(reviewed.status).toBe(200);
    const updated = RunSchema.parse(reviewed.body);
    if (updated.status !== 'completed' || updated.review === undefined) throw new Error('unreachable');
    expect(updated.review.decision).toBe('confirmed');
    expect(updated.review.action).toEqual(updated.result.action);
    expect(updated.events[updated.events.length - 1]?.type).toBe('review.decided');

    const repeat = await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'confirmed'});
    expect(repeat.status).toBe(409);
  });

  it('applies an override review with a server-computed amount and a human_override precedent', async () => {
    const api = app();
    const run = await runFixture(api, 'N2H');
    const expected = eligibleCentsFor(run, 'refund_no_show_fee');
    const reviewed = await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'overridden', remedyId: 'refund_no_show_fee', note: 'Policy review.'});
    expect(reviewed.status).toBe(200);
    const updated = RunSchema.parse(reviewed.body);
    if (updated.status !== 'completed' || updated.review === undefined) throw new Error('unreachable');
    expect(updated.review.decision).toBe('overridden');
    expect(updated.review.ruling).toBe('rider_favored');
    expect(updated.review.action.amountCents).toBe(expected);

    const listing = await request(api).get('/api/precedents');
    const override = listing.body.precedents.find((p: {origin: string; runId?: string}) => p.origin === 'human_override' && p.runId === run.id);
    expect(override).toBeDefined();

    // The feedback loop: the override precedent surfaces on the next similar run
    // and the outcome stays at the expected remedy and amount.
    const next = await runFixture(api, 'N2');
    expect(next.precedents?.some(p => p.origin === 'human_override' && p.runId === run.id)).toBe(true);
    expect(next.status).toBe('completed');
    if (next.status !== 'completed') throw new Error('unreachable');
    expect(next.result.action.remedyId).toBe('keep_charge');
    expect(next.result.action.amountCents).toBe(0);
  });

  it('rejects an override remedy that does not fit the dispute category', async () => {
    const api = app();
    const run = await runFixture(api, 'N2H');
    const reviewed = await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'overridden', remedyId: 'refund_route_excess'});
    expect(reviewed.status).toBe(422);
    expect(reviewed.body.error.code).toBe('REVIEW_REMEDY_INVALID');
  });

  it('validates review requests', async () => {
    const api = app();
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    expect((await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'confirmed'})).status).toBe(409);
    expect((await request(api).post('/api/runs/does-not-exist/review').send({decision: 'confirmed'})).status).toBe(404);
    expect((await request(api).post(`/api/runs/${run.id}/review`).send({note: 'no decision'})).status).toBe(400);
  });

  it('escalates a confident ruling when the threshold demands it', async () => {
    const api = app(liveConfig({ESCALATION_CONFIDENCE_THRESHOLD: '1'}));
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation?.reasons).toEqual(['low_confidence']);
  });

  it('falls back to the deterministic assessment when the risk model fails', async () => {
    const inner = createScriptedModel();
    const failing: ModelAdapter = {
      async complete(messages, signal) {
        if (messages[0]?.content.startsWith('You are the Risk Analyst')) throw new Error('Risk provider down');
        return inner.complete(messages, signal);
      }
    };
    const api = app(liveConfig(), failing);
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    expect(run.risk?.source).toBe('deterministic');
    expect(run.events.some(e => e.summary.includes('unavailable'))).toBe(false);
  });

  it('ends a workflow failure as incomplete when decisive evidence is missing, failed otherwise', async () => {
    const failing: ModelAdapter = {async complete() {throw new Error('synthetic advocate failure');}};
    const api = app(liveConfig(), failing);

    const x5 = await runFixture(api, 'X5');
    expect(x5.status).toBe('incomplete');
    if (x5.status !== 'incomplete') throw new Error('unreachable');
    expect(x5.missingEvidence.join(' ')).toContain('gps');
    const last = x5.events.at(-1);
    expect(last?.type).toBe('run.incomplete');
    expect(last?.summary).toContain('Workflow error');
    expect(last?.summary).toContain('synthetic advocate failure');

    const n2 = await runFixture(api, 'N2');
    expect(n2.status).toBe('failed');
    if (n2.status !== 'failed') throw new Error('unreachable');
    expect(n2.error.message).toContain('synthetic advocate failure');
  });

  it('repairs a driver advocate case that cites an invented policy id', async () => {
    const inner = createScriptedModel();
    let injected = false;
    const citing: ModelAdapter = {
      async complete(messages, signal) {
        const system = messages[0]?.content ?? '';
        const retrieved = messages.some(m => m.role === 'user' && m.content.startsWith('Evidence retrieval results:'));
        if (system.startsWith('You are the Driver Advocate') && retrieved && !injected) {
          injected = true;
          return JSON.stringify({
            type: 'final_case',
            case: {
              side: 'driver', summary: 'Scripted driver case citing an invented policy (test double).',
              arguments: [{claim: 'Invented citation', evidenceIds: [], policyClauseIds: ['GE-1']}],
              counterevidence: [], requestedRemedyId: 'keep_charge', missingFacts: []
            }
          });
        }
        return inner.complete(messages, signal);
      }
    };
    const api = app(liveConfig(), citing);
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    expect(injected).toBe(true);
    const repairs = run.events.filter(e => e.actor === 'driver' && e.type === 'output.repair');
    expect(repairs).toHaveLength(1);
    expect(repairs[0]?.summary).toContain('citation');
  });

  it('keeps stub runs free of risk, escalation and review', async () => {
    const api = createApp(readConfig({}));
    const run = await runFixture(api, 'dispute-route-example');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.risk).toBeUndefined();
    expect(run.escalation).toBeUndefined();
    expect((await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'confirmed'})).status).toBe(409);
    const listing = await request(api).get('/api/precedents');
    expect(listing.body.count).toBe(0);
    expect(listing.body.precedents).toEqual([]);
  });
});
