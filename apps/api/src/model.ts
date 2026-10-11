import type { ModelAdapter } from '@fairtrip/agents';
import { requireModelConfig, type Config } from './config.js';

export function createModelAdapter(config: Config, fetcher: typeof fetch = fetch): ModelAdapter {
  requireModelConfig(config);
  return {
    async complete(messages, signal) {
      const response = await fetcher(`${config.MODEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}`},
        body: JSON.stringify({model: config.MODEL_NAME, messages, stream: false}),
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
