import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RunSchema, type Run } from '@fairtrip/contracts';
import type { ModelAdapter } from '@fairtrip/agents';
import { createScriptedModel } from '../integration/scripted-model.js';
import { app, eligibleCentsFor, liveConfig, runFixture, terminalRun } from './helpers.js';

// Adversarial money-guardrail suite, attack class F: lifecycle abuse — late
// completions, retry chains, concurrent starts and tampered replay records —
// must never pay twice or pay a tampered amount.

const REPLAY_SOURCE = 'apps/api/replays/20261013-144417/R1-1.json';

function tamperedReplayDir(mutate: (result: Record<string, unknown>) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'fairtrip-replay-'));
  const record = JSON.parse(readFileSync(REPLAY_SOURCE, 'utf8')) as {run: {result: Record<string, unknown>}};
  mutate(record.run.result);
  writeFileSync(join(dir, 'R1-1.json'), JSON.stringify(record));
  return dir;
}

describe('adversarial lifecycle attacks', () => {
  it('F1: a Judge response arriving after the deadline never pays twice', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    try {
      const inner = createScriptedModel();
      let judgeCalls = 0;
      const tardy: ModelAdapter = {
        async complete(messages, signal) {
          const system = messages[0]?.content ?? '';
          if (!system.startsWith('You are the Judge')) return inner.complete(messages, signal);
          judgeCalls += 1;
          const response = await inner.complete(messages, signal);
          if (judgeCalls > 1) return response;
          // Ignores cancellation and resolves the refund after the 90 s deadline.
          await new Promise(resolve => setTimeout(resolve, 120_000));
          return response;
        }
      };
      const api = app(liveConfig(), tardy);
      const started = await request(api).post('/api/runs').send({fixtureId: 'R1'});
      expect(started.status).toBe(202);
      const id = String(started.body.id);
      await new Promise(r => setImmediate(r));
      await vi.advanceTimersByTimeAsync(90_000);
      const first = RunSchema.parse((await request(api).get(`/api/runs/${id}`)).body);
      expect(first.status).toBe('failed');
      if (first.status !== 'failed') throw new Error('unreachable');
      expect(first.error.message).toContain('deadline exceeded');
      const retryId = first.retriedBy;
      expect(retryId).toBeDefined();
      if (retryId === undefined) throw new Error('unreachable');

      // Drive the normal re-run to completion: scripted model resolves on
      // microtasks, workflow start rides real immediates.
      let second: Run | undefined;
      for (let i = 0; i < 200; i++) {
        const res = await request(api).get(`/api/runs/${retryId}`);
        if (['completed', 'failed', 'incomplete'].includes(res.body.status as string)) {
          second = RunSchema.parse(res.body);
          break;
        }
        await vi.advanceTimersByTimeAsync(50);
        await new Promise(r => setImmediate(r));
      }
      if (second === undefined) throw new Error('re-run did not reach a terminal status');
      expect(second.status).toBe('completed');
      expect(second.retryOf).toBe(id);

      // Let the tardy first attempt finally resolve past the deadline.
      await vi.advanceTimersByTimeAsync(60_000);
      await new Promise(r => setImmediate(r));
      const firstAfter = RunSchema.parse((await request(api).get(`/api/runs/${id}`)).body);
      expect(firstAfter.status).toBe('failed');
      expect(firstAfter).not.toHaveProperty('result');
      expect([firstAfter, second].filter(r => r.status === 'completed')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('F2: a re-run never spawns a third attempt', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    try {
      const hanging: ModelAdapter = {complete: () => new Promise<string>(() => {})};
      const api = app(liveConfig(), hanging);
      const started = await request(api).post('/api/runs').send({fixtureId: 'R1'});
      expect(started.status).toBe(202);
      const id = String(started.body.id);
      await new Promise(r => setImmediate(r));
      await vi.advanceTimersByTimeAsync(90_000);
      const first = RunSchema.parse((await request(api).get(`/api/runs/${id}`)).body);
      expect(first.status).toBe('failed');
      if (first.status !== 'failed') throw new Error('unreachable');
      const retryId = first.retriedBy;
      expect(retryId).toBeDefined();
      if (retryId === undefined) throw new Error('unreachable');
      await new Promise(r => setImmediate(r));
      await vi.advanceTimersByTimeAsync(90_000);
      const second = RunSchema.parse((await request(api).get(`/api/runs/${retryId}`)).body);
      expect(second.status).toBe('failed');
      expect(second.retryOf).toBe(id);
      if (second.status !== 'failed') throw new Error('unreachable');
      expect(second.retriedBy).toBeUndefined();
      const list = await request(api).get('/api/runs');
      expect(list.body.runs).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('F3: documents: payments are recommendations; an execution layer must key on dispute id — the API does not dedupe', async () => {
    const api = app();
    const started = await Promise.all(Array.from({length: 5}, () =>
      request(api).post('/api/runs').send({fixtureId: 'R1'})));
    for (const res of started) expect(res.status).toBe(202);
    const ids = new Set(started.map(res => String(res.body.id)));
    expect(ids.size).toBe(5);
    const runs = await Promise.all([...ids].map(id => terminalRun(api, id)));
    for (const run of runs) {
      expect(run.status).toBe('completed');
      if (run.status !== 'completed') throw new Error('unreachable');
      expect(run.result.action.remedyId).toBe('refund_route_excess');
      expect(run.result.action.amountCents).toBe(eligibleCentsFor(run, 'refund_route_excess'));
    }
  });

  it('F4: a tampered replay amount fails with REPLAY_INVALID and the recorded figure named', async () => {
    const dir = tamperedReplayDir(result => {
      (result.action as Record<string, unknown>).amountCents = 99999;
    });
    const api = app(liveConfig({RUN_MODE: 'replay', REPLAY_DIR: dir, REPLAY_SPEED: '100'}));
    const started = await request(api).post('/api/runs').send({fixtureId: 'R1'});
    expect(started.status).toBe(202);
    const run = await terminalRun(api, String(started.body.id));
    expect(run.status).toBe('failed');
    if (run.status !== 'failed') throw new Error('unreachable');
    expect(run.error.code).toBe('REPLAY_INVALID');
    expect(run.error.message).toContain('99999');
  });

  it('F4: a tampered replay remedy diverging from the verdict replays as a policy_divergence escalation', async () => {
    const dir = tamperedReplayDir(result => {
      result.remedyId = 'keep_charge';
      result.action = {
        remedyId: 'keep_charge', recipient: 'none', currency: 'SGD',
        amountCents: 0, recommendation: 'No refund recommended. The charge is retained.',
      };
    });
    const api = app(liveConfig({RUN_MODE: 'replay', REPLAY_DIR: dir, REPLAY_SPEED: '100'}));
    const started = await request(api).post('/api/runs').send({fixtureId: 'R1'});
    expect(started.status).toBe(202);
    const run = await terminalRun(api, String(started.body.id));
    // Identical to a live divergence: the replay completes escalated for human
    // review and nothing is finalised. The replay VERDICT_INVARIANT branch is
    // unreachable by design — finalisationDecision always escalates a
    // remedy/verdict mismatch before the invariant is checked.
    expect(run.status).toBe('completed');
    if (run.status !== 'completed') throw new Error('unreachable');
    expect(run.escalation?.reasons).toContain('policy_divergence');
    expect(run.divergence?.verdictOutcome).toBe(run.verdict?.outcome);
    expect(run.divergence?.verdictOutcome).toBe('refund_route_excess');
    expect(run.review).toBeUndefined();
  });

  it('a call-level model.retry event is not a workflow failure and never spawns a re-run', async () => {
    const inner = createScriptedModel();
    let recovered = false;
    const model: ModelAdapter = {
      async complete(messages, signal, options) {
        if (!recovered) {
          recovered = true;
          options?.onRecovery?.({kind: 'retry', summary: 'model call retry 1: network error'});
        }
        return inner.complete(messages, signal);
      }
    };
    const api = app(liveConfig(), model);
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('completed');
    expect(run.events.some(event => event.type === 'model.retry')).toBe(true);
    expect(run.events.some(event => event.type === 'run.retrying')).toBe(false);
    const list = await request(api).get('/api/runs');
    expect(list.body.runs).toHaveLength(1);
  });

  it('F5: a model HTTP 4xx request error is a request-shape problem — no re-run', async () => {
    // The DashScope regression: a request shape the provider rejects fails every
    // attempt identically, so re-running the whole workflow only doubles cost.
    const badRequest: ModelAdapter = {
      complete: () => Promise.reject(new Error('Model request failed (HTTP 400): \'type\' must be in ["enabled", "disabled", "auto"]'))
    };
    const api = app(liveConfig(), badRequest);
    const run = await runFixture(api, 'R1');
    expect(run.status).toBe('failed');
    if (run.status !== 'failed') throw new Error('unreachable');
    expect(run.error.message).toContain('HTTP 400');
    expect(run.retriedBy).toBeUndefined();
    expect(run.events.some(event => event.type === 'run.retrying')).toBe(false);
    const list = await request(api).get('/api/runs');
    expect(list.body.runs).toHaveLength(1);
  });

  it('F6: a transient model HTTP 5xx still earns the one automatic re-run', async () => {
    const unavailable: ModelAdapter = {
      complete: () => Promise.reject(new Error('Model request failed (HTTP 503): upstream unavailable'))
    };
    const api = app(liveConfig(), unavailable);
    const first = await runFixture(api, 'R1');
    expect(first.status).toBe('failed');
    const retryId = first.retriedBy;
    expect(retryId).toBeDefined();
    if (retryId === undefined) throw new Error('unreachable');
    const second = await terminalRun(api, retryId);
    expect(second.status).toBe('failed');
    expect(second.retryOf).toBe(first.id);
    if (second.status !== 'failed') throw new Error('unreachable');
    expect(second.retriedBy).toBeUndefined();
    const list = await request(api).get('/api/runs');
    expect(list.body.runs).toHaveLength(2);
  });
});
