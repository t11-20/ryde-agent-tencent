import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { RunSchema, type PolicyVerdict, type Run } from '@fairtrip/contracts';
import { createFixtureSource, loadDataset } from '@fairtrip/evidence';
import type { DisputeSource, ModelAdapter } from '@fairtrip/agents';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig, type Config } from '../../apps/api/src/config.js';
import { createScriptedModel } from './scripted-model.js';

// The deterministic policy verdict bounds the Judge: a completed run without an
// escalation must match the verdict, and any first-attempt failure retries once.

const liveConfig = (extra: Record<string, string> = {}): Config =>
  readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'scripted', ...extra});
const app = (config: Config = liveConfig(), model?: ModelAdapter, source?: DisputeSource) =>
  createApp(config, model ?? createScriptedModel(), source ?? createFixtureSource());

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

describe('policy verdict on live runs', () => {
  const dataset = loadDataset();

  it.each(dataset.expected.map(e => e.fixtureId))('%s carries a verdict and no unescalated completed run diverges', async (fixtureId) => {
    const api = app();
    const run = await runFixture(api, fixtureId);
    expect(run.verdict).toBeDefined();
    expect(run.events.some(e => e.type === 'verdict.computed')).toBe(true);
    if (run.status === 'completed') {
      if (run.escalation === undefined) expect(run.result.action.remedyId).toBe(run.verdict?.outcome);
    } else {
      expect(run.status).toBe('incomplete');
      expect(run.verdict?.outcome).toBe('incomplete');
    }
  });

  it('escalates with policy_divergence when the Judge remedy differs from the verdict', async () => {
    const inner = createScriptedModel();
    const divergent: ModelAdapter = {
      async complete(messages, signal) {
        const raw = await inner.complete(messages, signal);
        if (!(messages[0]?.content ?? '').startsWith('You are the Judge')) return raw;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        parsed.remedyId = 'refund_route_excess';
        parsed.ruling = 'rider_favored';
        return JSON.stringify(parsed);
      }
    };
    const api = app(liveConfig(), divergent);
    const before = (await request(api).get('/api/precedents')).body.count as number;

    const run = await runFixture(api, 'R3');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.verdict?.outcome).toBe('keep_charge');
    expect(run.escalation?.reasons).toContain('policy_divergence');
    expect(run.divergence?.judgeRemedyId).toBe('refund_route_excess');
    expect(run.divergence?.verdictOutcome).toBe('keep_charge');
    // The Judge's action stays as produced, with the server-computed amount.
    expect(run.result.action.remedyId).toBe('refund_route_excess');
    expect(run.result.action.amountCents).toBe(eligibleCentsFor(run, 'refund_route_excess'));
    // A divergent (escalated) run writes no run precedent before review.
    const listing = await request(api).get('/api/precedents');
    expect(listing.body.count).toBe(before);

    const confirmed = await request(api).post(`/api/runs/${run.id}/review`).send({decision: 'confirmed', note: 'Keeping the Judge ruling.'});
    expect(confirmed.status).toBe(200);
    const kept = RunSchema.parse(confirmed.body);
    if (kept.status !== 'completed' || kept.review === undefined) throw new Error('unreachable');
    expect(kept.review.action.remedyId).toBe('refund_route_excess');

    const second = await runFixture(api, 'R3');
    expect(second.status).toBe('completed');
    if (second.status !== 'completed') throw new Error('unreachable');
    expect(second.escalation?.reasons).toContain('policy_divergence');
    const overridden = await request(api).post(`/api/runs/${second.id}/review`).send({decision: 'overridden', remedyId: 'keep_charge'});
    expect(overridden.status).toBe(200);
    const fixed = RunSchema.parse(overridden.body);
    if (fixed.status !== 'completed' || fixed.review === undefined) throw new Error('unreachable');
    expect(fixed.review.action.remedyId).toBe('keep_charge');
    expect(fixed.review.action.amountCents).toBe(0);
  });

  it('escalates with policy_undetermined when the source verdict is undetermined', async () => {
    const source = createFixtureSource();
    const undetermined: PolicyVerdict = {
      outcome: 'undetermined', clauseIds: ['RD-3'],
      basis: 'conflicting rider chat signals: consent and objection', features: [], missingFamilies: [],
    };
    const api = createApp(liveConfig(), createScriptedModel(), {...source, policyVerdict: () => undetermined});
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation?.reasons).toContain('policy_undetermined');
    expect(run.divergence).toBeUndefined();
  });
});

describe('automatic re-run on a workflow failure', () => {
  it('retries once after a timeout and links both runs', async () => {
    const inner = createScriptedModel();
    let timedOut = false;
    const flaky: ModelAdapter = {
      async complete(messages, signal) {
        if (!timedOut) {
          timedOut = true;
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        }
        return inner.complete(messages, signal);
      }
    };
    const api = app(liveConfig(), flaky);
    const first = await runFixture(api, 'R1');
    expect(first.status).toBe('failed');
    if (first.status !== 'failed') throw new Error('unreachable');
    expect(first.error.message).toContain('aborted due to timeout');
    expect(first.retriedBy).toBeDefined();
    expect(first.events.some(e => e.type === 'run.retrying')).toBe(true);
    expect(first.events.at(-1)?.type).toBe('run.failed');

    const secondId = first.retriedBy;
    if (secondId === undefined) throw new Error('unreachable');
    const second = await terminalRun(api, secondId);
    expect(second.status).toBe('completed');
    expect(second.retryOf).toBe(first.id);

    const list = await request(api).get('/api/runs');
    expect(list.body.runs.map((r: {id: string}) => r.id)).toEqual([second.id, first.id]);
  });

  it('re-runs a model-output failure once and completes when the next attempt is clean', async () => {
    const inner = createScriptedModel();
    let failedOnce = false;
    const flaky: ModelAdapter = {
      async complete(messages, signal) {
        if (!failedOnce) {
          failedOnce = true;
          throw new Error('unparseable output after repairs');
        }
        return inner.complete(messages, signal);
      }
    };
    const api = app(liveConfig(), flaky);
    const first = await runFixture(api, 'R1');
    expect(first.status).toBe('failed');
    if (first.status !== 'failed') throw new Error('unreachable');
    expect(first.retriedBy).toBeDefined();
    expect(first.events.some(e => e.type === 'run.retrying' && e.summary.startsWith('Workflow failure'))).toBe(true);
    const second = await terminalRun(api, String(first.retriedBy));
    expect(second.status).toBe('completed');
    expect(second.retryOf).toBe(first.id);
    const list = await request(api).get('/api/runs');
    expect(list.body.runs).toHaveLength(2);
  });

  it('a re-run that fails again is not re-run a third time', async () => {
    const failing: ModelAdapter = {async complete() {throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');}};
    const api = app(liveConfig(), failing);
    const first = await runFixture(api, 'R1');
    if (first.status !== 'failed') throw new Error('unreachable');
    const secondId = first.retriedBy;
    if (secondId === undefined) throw new Error('unreachable');
    const second = await terminalRun(api, secondId);
    expect(second.status).toBe('failed');
    expect(second.retryOf).toBe(first.id);
    if (second.status !== 'failed') throw new Error('unreachable');
    expect(second.retriedBy).toBeUndefined();
    const list = await request(api).get('/api/runs');
    expect(list.body.runs).toHaveLength(2);
  });
});
