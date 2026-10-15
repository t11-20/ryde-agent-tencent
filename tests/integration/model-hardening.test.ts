import { describe, expect, it, vi } from 'vitest';
import { extractJsonText } from '@fairtrip/agents';
import { createModelAdapter, parseExtraBody, providerProfile } from '../../apps/api/src/model.js';
import { readConfig } from '../../apps/api/src/config.js';

describe('model call retries', () => {
  const retryConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'm'});
  const okResponse = () => new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}]}), {status: 200});
  const complete = (adapter: ReturnType<typeof createModelAdapter>) =>
    adapter.complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal);

  it('retries once after a per-attempt timeout and returns the content', async () => {
    let calls = 0;
    const reasons: string[] = [];
    const fetcher: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      return okResponse();
    };
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: reason => reasons.push(reason)});
    await expect(complete(adapter)).resolves.toBe('{"ok":true}');
    expect(calls).toBe(2);
    expect(reasons).toEqual(['attempt timeout']);
  });

  it('retries a network TypeError', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return okResponse();
    };
    await expect(complete(createModelAdapter(retryConfig, fetcher, {onRetry: () => {}}))).resolves.toBe('{"ok":true}');
    expect(calls).toBe(2);
  });

  it('retries an HTTP 503', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return calls === 1 ? new Response('upstream unavailable', {status: 503}) : okResponse();
    };
    await expect(complete(createModelAdapter(retryConfig, fetcher, {onRetry: () => {}}))).resolves.toBe('{"ok":true}');
    expect(calls).toBe(2);
  });

  it('does not retry an HTTP 400', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls += 1; return new Response('{"error":"bad request"}', {status: 400}); };
    await expect(complete(createModelAdapter(retryConfig, fetcher, {onRetry: () => {}}))).rejects.toThrow('HTTP 400');
    expect(calls).toBe(1);
  });

  it('does not call the provider at all when the caller signal is already aborted', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls += 1; return okResponse(); };
    const controller = new AbortController();
    controller.abort();
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
    await expect(adapter.complete([{role: 'user', content: 'x'}], controller.signal)).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it('rejects after exactly two attempts when every attempt times out', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    };
    await expect(complete(createModelAdapter(retryConfig, fetcher, {onRetry: () => {}}))).rejects.toThrow('timeout');
    expect(calls).toBe(2);
  });

  it('retries network failures twice with backoff and reports every retry', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const recoveries: {kind: string; summary: string}[] = [];
      const fetcher: typeof fetch = async () => {
        calls += 1;
        if (calls <= 2) throw new TypeError('fetch failed');
        return okResponse();
      };
      const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
      const pending = adapter.complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal,
        {onRecovery: event => recoveries.push(event)});
      // First failure -> 300 ms backoff -> second failure -> 1000 ms backoff -> third succeeds.
      await vi.advanceTimersByTimeAsync(299);
      expect(calls).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toBe(2);
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toBe(2);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe('{"ok":true}');
      expect(calls).toBe(3);
      expect(recoveries.map(event => event.kind)).toEqual(['retry', 'retry']);
      expect(recoveries[0]?.summary).toContain('network error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects after a third consecutive network failure', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        throw new TypeError('fetch failed');
      };
      const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
      const pending = adapter.complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal);
      const assertion = expect(pending).rejects.toThrow('fetch failed');
      await vi.advanceTimersByTimeAsync(2000);
      await assertion;
      expect(calls).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a timeout without backoff', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetcher: typeof fetch = async () => {
        calls += 1;
        if (calls === 1) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        return okResponse();
      };
      const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
      const pending = adapter.complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal);
      // No backoff: the retry fires on microtasks alone.
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toBe(2);
      await expect(pending).resolves.toBe('{"ok":true}');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('model request body', () => {
  const retryConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://api.minimax.io/v1', MODEL_NAME: 'MiniMax-M3'});
  const okResponse = () => new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}]}), {status: 200});
  const captureBodies = () => {
    const bodies: Record<string, unknown>[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return okResponse();
    };
    return {bodies, fetcher};
  };
  const messages: {role: 'user'; content: string}[] = [{role: 'user', content: 'Return JSON'}];

  it('sends reasoning_split, thinking per option and service_tier only when priority', async () => {
    const {bodies, fetcher} = captureBodies();
    const config = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://api.minimax.io/v1', MODEL_NAME: 'MiniMax-M3', MODEL_SERVICE_TIER: 'priority'});
    const adapter = createModelAdapter(config, fetcher, {onRetry: () => {}});
    const signal = new AbortController().signal;
    await adapter.complete(messages, signal, {thinking: 'off'});
    await adapter.complete(messages, signal, {thinking: 'adaptive'});
    await adapter.complete(messages, signal);
    expect(bodies[0]).toMatchObject({reasoning_split: true, service_tier: 'priority', thinking: {type: 'disabled'}});
    expect(bodies[1]).toMatchObject({reasoning_split: true, thinking: {type: 'adaptive'}});
    expect(bodies[2]).toMatchObject({reasoning_split: true, service_tier: 'priority'});
    expect(bodies[2]).not.toHaveProperty('thinking');
  });

  it('omits service_tier on the standard tier', async () => {
    const {bodies, fetcher} = captureBodies();
    await createModelAdapter(retryConfig, fetcher, {onRetry: () => {}}).complete(messages, new AbortController().signal, {thinking: 'off'});
    expect(bodies[0]).toMatchObject({reasoning_split: true, thinking: {type: 'disabled'}});
    expect(bodies[0]).not.toHaveProperty('service_tier');
  });

  it('lets MODEL_EXTRA_BODY override reasoning_split', async () => {
    const {bodies, fetcher} = captureBodies();
    const config = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://api.minimax.io/v1', MODEL_NAME: 'MiniMax-M3', MODEL_EXTRA_BODY: '{"reasoning_split":false}'});
    await createModelAdapter(config, fetcher, {onRetry: () => {}}).complete(messages, new AbortController().signal);
    expect(bodies[0]?.reasoning_split).toBe(false);
  });
});

describe('model call hedging', () => {
  const retryConfig = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'm'});
  const okResponse = () => new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}]}), {status: 200});
  const messages: {role: 'user'; content: string}[] = [{role: 'user', content: 'Return JSON'}];

  it('resolves with the hedged lane and aborts the slow one', async () => {
    let calls = 0;
    const recoveries: {kind: string; summary: string}[] = [];
    const signals: AbortSignal[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      calls += 1;
      const requestSignal = init?.signal as AbortSignal;
      signals.push(requestSignal);
      if (calls === 1) {
        // Lane A never resolves until it is aborted.
        return new Promise<Response>((_resolve, reject) => {
          requestSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      return okResponse();
    };
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
    const content = await adapter.complete(messages, new AbortController().signal, {hedgeAfterMs: 10, onRecovery: event => recoveries.push(event)});
    expect(content).toBe('{"ok":true}');
    expect(calls).toBe(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(recoveries.map(event => event.kind)).toEqual(['hedge', 'hedge_won']);
  });

  it('never starts the hedge when the lane answers in time', async () => {
    let calls = 0;
    const recoveries: {kind: string; summary: string}[] = [];
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return okResponse();
    };
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
    const content = await adapter.complete(messages, new AbortController().signal, {hedgeAfterMs: 10, onRecovery: event => recoveries.push(event)});
    expect(content).toBe('{"ok":true}');
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(calls).toBe(1);
    expect(recoveries).toEqual([]);
  });

  it('rejects with lane A\'s error when both lanes fail', async () => {
    const recoveries: {kind: string; summary: string}[] = [];
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
        throw new Error('lane A down');
      }
      throw new Error('lane B down');
    };
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
    await expect(adapter.complete(messages, new AbortController().signal, {hedgeAfterMs: 10, onRecovery: event => recoveries.push(event)}))
      .rejects.toThrow('lane A down');
    expect(calls).toBe(2);
    expect(recoveries.map(event => event.kind)).toEqual(['hedge']);
  });

  it('never hedges when the caller signal is already aborted', async () => {
    let calls = 0;
    const recoveries: {kind: string; summary: string}[] = [];
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return okResponse();
    };
    const controller = new AbortController();
    controller.abort();
    const adapter = createModelAdapter(retryConfig, fetcher, {onRetry: () => {}});
    await expect(adapter.complete(messages, controller.signal, {hedgeAfterMs: 10, onRecovery: event => recoveries.push(event)})).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(calls).toBe(0);
    expect(recoveries).toEqual([]);
  });
});

describe('model output hardening', () => {
  it('extracts JSON from fences, think blocks and surrounding prose', () => {
    expect(extractJsonText('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonText('<think>x</think>{"a":1}')).toBe('{"a":1}');
    expect(extractJsonText('Here: {"a":1} thanks')).toBe('{"a":1}');
    expect(extractJsonText('not json')).toBe('not json');
  });
  it('parses MODEL_EXTRA_BODY safely', () => {
    expect(parseExtraBody('')).toEqual({});
    expect(parseExtraBody('{"response_format":{"type":"json_object"},"model":"x"}')).toEqual({response_format: {type: 'json_object'}});
    expect(() => parseExtraBody('[1]')).toThrow('MODEL_EXTRA_BODY');
  });
  it('merges extra body options without overriding model, messages or stream', async () => {
    const bodies: unknown[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}]}), {status: 200});
    };
    const config = readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: 'https://example.com/v1', MODEL_NAME: 'm', MODEL_EXTRA_BODY: '{"response_format":{"type":"json_object"},"model":"evil"}'});
    await createModelAdapter(config, fetcher).complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal);
    expect(bodies[0]).toMatchObject({model: 'm', stream: false, response_format: {type: 'json_object'}});
  });
});

describe('provider profile', () => {
  const cfg = (url: string, name: string, extra: Record<string, string> = {}) =>
    readConfig({RUN_MODE: 'live', MODEL_API_KEY: 'k', MODEL_BASE_URL: url, MODEL_NAME: name, ...extra});

  it('detects MiniMax by host or model name and treats everything else as generic', () => {
    expect(providerProfile(cfg('https://api.minimax.io/v1', 'm'))).toBe('minimax');
    expect(providerProfile(cfg('https://apix.minimax.io/v1', 'm'))).toBe('minimax');
    expect(providerProfile(cfg('https://example.com/v1', 'MiniMax-M3'))).toBe('minimax');
    expect(providerProfile(cfg('https://token-plan.ap-southeast-1.maas.aliyuncs.com/v1', 'deepseek-v4.1-flash'))).toBe('generic');
    expect(providerProfile(cfg('https://example.com/v1', 'm'))).toBe('generic');
    // An unparsable base URL falls through to the model-name check.
    expect(providerProfile({MODEL_BASE_URL: 'not a url', MODEL_NAME: 'm'})).toBe('generic');
  });

  it('sends no MiniMax body fields to a generic provider even with thinking and tier configured', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({choices: [{message: {content: '{"ok":true}'}}]}), {status: 200});
    };
    const config = cfg('https://token-plan.ap-southeast-1.maas.aliyuncs.com/v1', 'deepseek-v4.1-flash',
      {MODEL_THINKING: 'adaptive', MODEL_SERVICE_TIER: 'priority', MODEL_EXTRA_BODY: '{"enable_thinking":false,"temperature":0.3}'});
    await createModelAdapter(config, fetcher, {onRetry: () => {}})
      .complete([{role: 'user', content: 'Return JSON'}], new AbortController().signal, {thinking: 'adaptive'});
    expect(bodies[0]).toMatchObject({enable_thinking: false, temperature: 0.3, model: 'deepseek-v4.1-flash', stream: false});
    expect(bodies[0]).not.toHaveProperty('reasoning_split');
    expect(bodies[0]).not.toHaveProperty('thinking');
    expect(bodies[0]).not.toHaveProperty('service_tier');
  });
});
