import { describe, it, expect, vi } from 'vitest';
import { readConfig } from '../apps/api/src/config.js';
import { createModelAdapter } from '../apps/api/src/model.js';
const config = () => readConfig({MODEL_API_KEY: 'test-secret', MODEL_BASE_URL: 'https://example.com/v1/', MODEL_NAME: 'test-model'});
describe('backend configuration and connectivity adapter', () => {
  it('permits offline stub mode and blocks live mode with missing credentials', () => {
    expect(readConfig({}).RUN_MODE).toBe('stub');
    expect(() => readConfig({RUN_MODE: 'live'})).toThrow('Model access pending');
    expect(() => createModelAdapter(readConfig({}))).toThrow('Model access pending');
    expect(() => readConfig({API_PORT: 'bad'})).toThrow('Invalid environment');
  });
  it('sends credentials only to the configured HTTPS endpoint and returns assistant text', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({choices: [{message: {content: 'ready'}}]}), {status: 200}));
    const output = await createModelAdapter(config(), fetcher).complete([{role: 'user', content: 'Test'}], new AbortController().signal);
    expect(output).toBe('ready'); expect(fetcher.mock.calls[0]![0]).toBe('https://example.com/v1/chat/completions');
    expect(fetcher.mock.calls[0]![1]?.redirect).toBe('error');
  });
  it('sanitizes provider errors and rejects empty outputs', async () => {
    const providerError = vi.fn<typeof fetch>(async () => new Response('secret provider error test-secret', {status: 401}));
    await expect(createModelAdapter(config(), providerError).complete([], new AbortController().signal)).rejects.toThrow('Model request failed (HTTP 401)');
    const empty = vi.fn<typeof fetch>(async () => new Response('{"choices":[]}', {status: 200}));
    await expect(createModelAdapter(config(), empty).complete([], new AbortController().signal)).rejects.toThrow('no text');
  });
  it('rejects insecure or credential-bearing base URLs', () => {
    for (const url of ['http://example.com/v1', 'https://name:secret@example.com/v1', 'https://example.com/v1?key=secret'])
      expect(() => createModelAdapter({...config(), MODEL_BASE_URL: url})).toThrow('HTTPS');
  });
});
