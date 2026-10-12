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

export function createModelAdapter(config: Config, fetcher: typeof fetch = fetch): ModelAdapter {
  requireModelConfig(config);
  const extraBody = parseExtraBody(config.MODEL_EXTRA_BODY);
  return {
    async complete(messages, signal) {
      const response = await fetcher(`${config.MODEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}`},
        body: JSON.stringify({...extraBody, model: config.MODEL_NAME, messages: ensureUserMessage(messages), stream: false}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), redirect: 'error'
      });
      if (!response.ok) throw new Error(`Model request failed (HTTP ${response.status})${await providerDetail(response)}`);
      const body = await response.json() as {choices?: {message?: {content?: unknown}}[]};
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Model returned no text content');
      return content;
    }
  };
}
