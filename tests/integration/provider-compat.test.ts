import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { RunSchema } from '@fairtrip/contracts';
import type { ModelAdapter } from '@fairtrip/agents';
import { createFixtureSource } from '@fairtrip/evidence';
import { createApp } from '../../apps/api/src/app.js';
import { readConfig } from '../../apps/api/src/config.js';
import { KICKOFF_MESSAGE, createModelAdapter, ensureUserMessage } from '../../apps/api/src/model.js';
import { createScriptedModel } from './scripted-model.js';

type Msg = Parameters<ModelAdapter['complete']>[0][number];
const liveConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'MiniMax-M3', MODEL_EXTRA_BODY: '{"reasoning_split":true}'});

// Behaves like MiniMax: rejects a request without a user message (HTTP 400, code 2013); otherwise answers through the given model.
function strictProvider(model: ModelAdapter, seen: string[][]): typeof fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {messages: Msg[]};
    seen.push(body.messages.map(m => m.role));
    if (!body.messages.some(m => m.role === 'user')) {
      return new Response(JSON.stringify({base_resp: {status_code: 2013, status_msg: 'invalid params, chat content is empty (2013)'}}), {status: 400});
    }
    const content = await model.complete(body.messages, new AbortController().signal);
    return new Response(JSON.stringify({choices: [{message: {content}}]}), {status: 200});
  };
}

describe('provider compatibility (MiniMax)', () => {
  it('adds a kickoff user message only when none exists, without mutating the input', () => {
    const systemOnly: Msg[] = [{role: 'system', content: 'S'}];
    expect(ensureUserMessage(systemOnly)).toEqual([{role: 'system', content: 'S'}, {role: 'user', content: KICKOFF_MESSAGE}]);
    expect(systemOnly).toHaveLength(1);
    const withUser: Msg[] = [{role: 'system', content: 'S'}, {role: 'user', content: 'U'}];
    expect(ensureUserMessage(withUser)).toBe(withUser);
    expect(ensureUserMessage([])).toEqual([{role: 'user', content: KICKOFF_MESSAGE}]);
  });

  it('includes the provider error text in the failure message', async () => {
    const failing: typeof fetch = async () => new Response('{"base_resp":{"status_code":1004,"status_msg":"login fail"}}', {status: 401});
    await expect(createModelAdapter(liveConfig, failing).complete([{role: 'user', content: 'x'}], new AbortController().signal))
      .rejects.toThrow('Model request failed (HTTP 401): {"base_resp":{"status_code":1004,"status_msg":"login fail"}}');
  });

  it('a full live R1 run succeeds against a provider that requires a user message', async () => {
    const seen: string[][] = [];
    const api = createApp(liveConfig, createModelAdapter(liveConfig, strictProvider(createScriptedModel(), seen)), createFixtureSource());
    const started = await request(api).post('/api/runs').send({fixtureId: 'R1'});
    expect(started.status).toBe(202);
    let body: unknown;
    for (let i = 0; i < 400; i++) {
      body = (await request(api).get(`/api/runs/${started.body.id}`)).body;
      if (['completed', 'failed', 'incomplete'].includes((body as {status: string}).status)) break;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const run = RunSchema.parse(body);
    if (run.status !== 'completed') throw new Error(`run ended ${run.status}: ${JSON.stringify(run.status === 'failed' ? run.error : run.status)}`);
    expect(run.result.action.amountCents).toBe(198);
    expect(seen.length).toBeGreaterThanOrEqual(5);
    expect(seen.every(roles => roles.includes('user'))).toBe(true);
  });
});
