# LB-11A — MiniMax compatibility: every request has a user message

**Goal:** fix the live HTTP 400 so real runs work with MiniMax-M3, make provider errors readable, add a regression test that would have caught it, then finish LB-11's live smoke runs.
**Requires:** LB-10, plus LB-11's code steps A1–A9 committed (`git log` shows "LB-11: harden model output parsing and add live smoke script") · **Who:** agent, with the human for the server · **SPEC:** §9 · **Screenshot moment:** YES
**⚠ Touches one Lane A file** (`apps/api/src/model.ts`). This card authorizes exactly the edits below. The Lane A owner reviews them in the pull request.

## Background (already diagnosed, do not re-investigate)

- Lane A's advocate tool loop opens every conversation with a system message only (`packages/agents/src/tool-loop.ts`).
- MiniMax-M3 rejects a request with no user message: HTTP 400, `invalid params, chat content is empty (2013)`. The Judge call (system + user) and `npm run check:model` (user only) were unaffected, which is why the connection check passed while every run failed.
- Decision: fix it at the provider boundary (`model.ts`), not in the tool loop. The workflow's messages stay unchanged; only the outgoing HTTP request gains a neutral kickoff turn when it has no user message.

## Files

Modify: `apps/api/src/model.ts` (the three edits below, nothing else), `harness/STATUS.md`
Create: `tests/integration/provider-compat.test.ts`

## Steps

1. In `harness/STATUS.md`, add this row directly below the LB-11 row:
```
| LB-11A | MiniMax compatibility: user message in every request | LB-10 | IN PROGRESS | | |
```

2. `apps/api/src/model.ts`, edit 1. Find `export function createModelAdapter(config: Config, fetcher: typeof fetch = fetch): ModelAdapter {` and insert this block directly above it:
```ts
type ChatMessage = Parameters<ModelAdapter['complete']>[0][number];

// Some providers reject a request that has no user message (MiniMax: HTTP 400 "chat content is empty (2013)").
// The advocate tool loop opens with a system message only, so the outgoing request gets a neutral kickoff turn.
export const KICKOFF_MESSAGE = 'Begin. Follow the system instructions and reply with a single JSON object.';
export function ensureUserMessage(messages: ChatMessage[]): ChatMessage[] {
  return messages.some(message => message.role === 'user') ? messages : [...messages, {role: 'user', content: KICKOFF_MESSAGE}];
}

// One line of the provider's error text (at most 200 characters) so failures can be diagnosed; never includes the key.
async function providerDetail(response: Response): Promise<string> {
  try {
    const text = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 200);
    return text ? `: ${text}` : '';
  } catch {
    return '';
  }
}

```

3. `apps/api/src/model.ts`, edit 2. Find
`body: JSON.stringify({...extraBody, model: config.MODEL_NAME, messages, stream: false}),`
and replace it with
`body: JSON.stringify({...extraBody, model: config.MODEL_NAME, messages: ensureUserMessage(messages), stream: false}),`

4. `apps/api/src/model.ts`, edit 3. Find
``if (!response.ok) throw new Error(`Model request failed (HTTP ${response.status})`);``
and replace it with
``if (!response.ok) throw new Error(`Model request failed (HTTP ${response.status})${await providerDetail(response)}`);``

If any find text in steps 2–4 is not present exactly once, STOP and show the current lines.

Check: `npm run typecheck` → no errors; `npm test` → all pass, including every original Lane A test.

5. Create `tests/integration/provider-compat.test.ts` with exactly this content:
```ts
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
```
This test fails without edits 1–3 (the run ends `failed`, exactly like the live symptom) and passes with them.

6. Run the Verify commands, set LB-11A to `DONE` in `harness/STATUS.md`, and commit: `LB-11A: send a user message in every model request and surface provider errors`.

7. Ask the human to stop the API (Ctrl+C in its terminal), start it again with `npm run dev`, and reply "server is running". Do not start it yourself.

8. Finish LB-11's step A10: run `npx tsx scripts/live-smoke.ts R1`, then `npx tsx scripts/live-smoke.ts N2`. Paste the RESULT lines into the LB-11 row of `harness/STATUS.md` and set LB-11 to `DONE`. Expected with a well-behaved model: R1 `completed: refund_route_excess, 198 cents`; N2 `completed: keep_charge, 0 cents`. A wrong remedy is a model-judgement issue for LB-15, not a failure here. Commit: `LB-11: record live smoke results`.

## Verify

- `npm run typecheck` → no errors
- `npm test` → all pass (every original Lane A test plus the 3 new ones)
- `npm run build` → passes
- After the restart: `npx tsx scripts/live-smoke.ts R1` reaches a terminal RESULT line (not `failed: … HTTP 400`)

## Acceptance

- [ ] Only the three listed edits in `apps/api/src/model.ts` (`git diff HEAD~1 -- apps/api` shows nothing else)
- [ ] The new test passes, and it proves a strict provider accepts every request of a full run
- [ ] Provider errors now show their text, for example `Model request failed (HTTP 400): …(2013)`
- [ ] Live smoke results for R1 and N2 recorded; LB-11 and LB-11A are DONE

## Stop if

- A smoke run still fails with HTTP 400. The error now includes MiniMax's own message: copy that exact line into `harness/STATUS.md` and the report, then STOP. Do not change any other file.
- A smoke run fails with HTTP 401, 404 or 429, or times out: follow LB-11's troubleshooting list and STOP.

## Commit

`LB-11A: send a user message in every model request and surface provider errors`, then `LB-11: record live smoke results`.
