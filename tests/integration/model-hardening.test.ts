import { describe, expect, it } from 'vitest';
import { extractJsonText } from '@fairtrip/agents';
import { createModelAdapter, parseExtraBody } from '../../apps/api/src/model.js';
import { readConfig } from '../../apps/api/src/config.js';

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
