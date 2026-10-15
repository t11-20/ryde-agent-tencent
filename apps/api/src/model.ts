import type { ModelAdapter } from '@fairtrip/agents';
import { EXECUTION_LIMITS } from '@fairtrip/agents';
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

// Carries the HTTP status so the retry policy can classify 4xx vs 408/429/5xx without parsing the message.
class ModelHttpError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Model request failed (HTTP ${status})${detail}`);
    this.name = 'ModelHttpError';
  }
}

const RETRYABLE_STATUSES = new Set([408, 429]);

/**
 * 'minimax' gets MiniMax-M3 body fields (reasoning_split, thinking, service_tier);
 * every other provider is 'generic' and is driven entirely by MODEL_EXTRA_BODY so
 * MiniMax parameters are never sent to endpoints that reject them.
 */
export function providerProfile(config: {MODEL_BASE_URL: string; MODEL_NAME: string}): 'minimax' | 'generic' {
  try {
    const host = new URL(config.MODEL_BASE_URL).hostname.toLowerCase();
    if (host === 'api.minimax.io' || host.endsWith('.minimax.io')) return 'minimax';
  } catch {
    // fall through to the model-name check
  }
  return config.MODEL_NAME.toLowerCase().startsWith('minimax') ? 'minimax' : 'generic';
}

interface Transient { kind: 'network' | 'http' | 'timeout'; reason: string }

// A retry reason, or null for failures a retry cannot fix (4xx client errors, empty content, caller abort).
// 'network' and 'http' share the networkRetries budget with backoff; 'timeout' uses modelRetries without.
function transientReason(error: unknown): Transient | null {
  if (error instanceof ModelHttpError) {
    return RETRYABLE_STATUSES.has(error.status) || error.status >= 500 ? {kind: 'http', reason: `HTTP ${error.status}`} : null;
  }
  if (error instanceof TypeError) return {kind: 'network', reason: 'network error'};
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return {kind: 'timeout', reason: 'attempt timeout'};
  return null;
}

// A sleep the caller signal can still cancel while the backoff is pending.
function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, {once: true});
  });
}

export function createModelAdapter(
  config: Config,
  fetcher: typeof fetch = fetch,
  hooks?: {onRetry?: (reason: string, attempt: number) => void}
): ModelAdapter {
  requireModelConfig(config);
  const extraBody = parseExtraBody(config.MODEL_EXTRA_BODY);
  const serviceTier = config.MODEL_SERVICE_TIER;
  const minimax = providerProfile(config) === 'minimax';
  const onRetry = hooks?.onRetry ?? ((reason: string, attempt: number) => {
    console.warn(`[fairtrip] model call retry ${attempt}: ${reason}`);
  });
  return {
    async complete(messages, signal, options) {
      const thinking = options?.thinking ?? 'default';
      const onRecovery = options?.onRecovery;
      const requestBody = () => JSON.stringify({
        ...(minimax ? {
          reasoning_split: true,
          ...(serviceTier === 'priority' ? {service_tier: 'priority'} : {}),
          ...(thinking === 'off' ? {thinking: {type: 'disabled'}} : thinking === 'adaptive' ? {thinking: {type: 'adaptive'}} : {})
        } : {}),
        ...extraBody,
        model: config.MODEL_NAME,
        messages: ensureUserMessage(messages),
        stream: false
      });

      // One lane: the attempt loop with per-kind retry budgets.
      const lane = async (laneSignal: AbortSignal): Promise<string> => {
        const used = {networkHttp: 0, timeout: 0};
        let retryNo = 0;
        while (true) {
          laneSignal.throwIfAborted();
          try {
            const response = await fetcher(`${config.MODEL_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
              method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}`},
              body: requestBody(),
              signal: AbortSignal.any([laneSignal, AbortSignal.timeout(EXECUTION_LIMITS.modelAttemptTimeoutMs)]), redirect: 'error'
            });
            if (!response.ok) throw new ModelHttpError(response.status, await providerDetail(response));
            const body = await response.json() as {choices?: {message?: {content?: unknown}}[]};
            const content = body.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) throw new Error('Model returned no text content');
            return content;
          } catch (error) {
            laneSignal.throwIfAborted();
            const transient = transientReason(error);
            if (transient === null) throw error;
            retryNo += 1;
            if (transient.kind === 'timeout') {
              if (used.timeout >= EXECUTION_LIMITS.modelRetries) throw error;
              used.timeout += 1;
            } else {
              if (used.networkHttp >= EXECUTION_LIMITS.networkRetries) throw error;
              used.networkHttp += 1;
            }
            onRecovery?.({kind: 'retry', summary: `model call retry ${retryNo}: ${transient.reason}`});
            onRetry(transient.reason, retryNo);
            if (transient.kind !== 'timeout') {
              const delays = EXECUTION_LIMITS.retryBackoffMs;
              const delay = delays[Math.min(used.networkHttp - 1, delays.length - 1)] ?? 0;
              if (delay > 0) await sleepWithAbort(delay, laneSignal);
            }
          }
        }
      };

      const hedgeAfterMs = options?.hedgeAfterMs;
      if (hedgeAfterMs === undefined || signal.aborted) return lane(signal);

      // Lane A runs under the caller signal; a slow lane spawns an identical
      // lane B after hedgeAfterMs. First fulfilment wins and aborts the loser.
      const ctrlA = new AbortController();
      let laneASettled = false;
      let laneAError: unknown;
      const promiseA = lane(AbortSignal.any([signal, ctrlA.signal])).then(
        value => { laneASettled = true; return value; },
        error => { laneASettled = true; laneAError = error; throw error; }
      );
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let ctrlB: AbortController | undefined;
        let laneBSettled = false;
        const finish = (value: string, wonByB: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (wonByB) {
            ctrlA.abort();
            onRecovery?.({kind: 'hedge_won', summary: 'hedged request answered first'});
          } else {
            ctrlB?.abort();
          }
          resolve(value);
        };
        const failWithLaneA = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          ctrlB?.abort();
          reject(laneAError);
        };
        // A rejected: only an in-flight lane B can still win; if B never
        // started or already settled, reject with lane A's error.
        promiseA.then(
          value => finish(value, false),
          () => { if (ctrlB === undefined || laneBSettled) failWithLaneA(); }
        );
        const timer = setTimeout(() => {
          if (settled || signal.aborted || laneASettled) return;
          ctrlB = new AbortController();
          onRecovery?.({kind: 'hedge', summary: `model call slow (> ${hedgeAfterMs / 1000} s); hedged request started`});
          void lane(AbortSignal.any([signal, ctrlB.signal])).then(
            value => finish(value, true),
            () => { laneBSettled = true; if (laneASettled) failWithLaneA(); }
          );
        }, hedgeAfterMs);
      });
    }
  };
}
