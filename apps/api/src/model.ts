import type { ModelAdapter } from '@fairtrip/agents';
import { requireModelConfig, type Config } from './config.js';

// MODEL_EXTRA_BODY: optional JSON object merged into every request body, e.g. {"response_format":{"type":"json_object"}}.
export function parseExtraBody(raw: string): Record<string, unknown> {
  if (!raw) return {};
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('MODEL_EXTRA_BODY must be a JSON object'); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('MODEL_EXTRA_BODY must be a JSON object');
  const extra = {...(value as Record<string, unknown>)};
  delete extra.model; delete extra.messages; delete extra.stream;
  return extra;
}

export function createModelAdapter(config: Config, fetcher: typeof fetch = fetch): ModelAdapter {
  requireModelConfig(config);
  const extraBody = parseExtraBody(config.MODEL_EXTRA_BODY);
  return {
    async complete(messages, signal) {
      const response = await fetcher(`${config.MODEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}`},
        body: JSON.stringify({...extraBody, model: config.MODEL_NAME, messages, stream: false}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), redirect: 'error'
      });
      if (!response.ok) throw new Error(`Model request failed (HTTP ${response.status})`);
      const body = await response.json() as {choices?: {message?: {content?: unknown}}[]};
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Model returned no text content');
      return content;
    }
  };
}
