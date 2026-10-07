import type { RawRun } from "./checks.js";
import { CreateRunResponseSchema, isTerminal, RunViewSchema, type RunEvent, type RunView } from "./contracts.js";

export interface RunnerOptions {
  baseUrl: string;
  timeoutMs: number;
  pollMs: number;
  /** Per-request HTTP timeout. */
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

class ContractMismatch extends Error {}

async function getJson(url: string, init: RequestInit, o: RunnerOptions): Promise<unknown> {
  const res = await (o.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(o.requestTimeoutMs ?? 15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  try { return await res.json(); } catch { throw new ContractMismatch(`non-JSON body from ${url}`); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /api/runs, then poll GET /api/runs/:id?after= until terminal or timeout. Never throws. */
export async function executeRun(fixtureId: string, attempt: number, o: RunnerOptions): Promise<RawRun> {
  const now = o.now ?? Date.now;
  const base = o.baseUrl.replace(/\/$/, "");
  const t0 = now();
  const startedAt = new Date(t0).toISOString();
  const done = (partial: Partial<RawRun>): RawRun => ({
    fixtureId, attempt, runId: null, startedAt, latencyMs: now() - t0, timedOut: false, error: null, view: null, ...partial,
  });

  let runId: string;
  try {
    const body = await getJson(`${base}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fixtureId }) }, o);
    const parsed = CreateRunResponseSchema.safeParse(body);
    if (!parsed.success) return done({ error: { code: "contract_mismatch", message: `POST /api/runs: ${parsed.error.message}` } });
    runId = parsed.data.runId;
  } catch (e) {
    return done({ error: { code: e instanceof ContractMismatch ? "contract_mismatch" : "network_error", message: `POST /api/runs: ${e instanceof Error ? e.message : String(e)}` } });
  }

  const events = new Map<number, RunEvent>();
  let view: RunView | null = null;
  let lastError: string | null = null;
  while (now() - t0 < o.timeoutMs) {
    try {
      const after = events.size ? Math.max(...events.keys()) : 0;
      const body = await getJson(`${base}/api/runs/${encodeURIComponent(runId)}?after=${after}`, {}, o);
      const parsed = RunViewSchema.safeParse(body);
      if (!parsed.success) return done({ runId, view, error: { code: "contract_mismatch", message: `GET /api/runs/:id: ${parsed.error.message}` } });
      for (const e of parsed.data.events) if (e.runId === runId && !events.has(e.sequence)) events.set(e.sequence, e);
      view = { ...parsed.data, events: [...events.values()].sort((a, b) => a.sequence - b.sequence) };
      lastError = null;
      if (isTerminal(view.status)) return done({ runId, view });
    } catch (e) {
      if (e instanceof ContractMismatch) return done({ runId, view, error: { code: "contract_mismatch", message: e.message } });
      lastError = e instanceof Error ? e.message : String(e);
    }
    await sleep(o.pollMs);
  }
  return done({ runId, view, timedOut: true, error: { code: "timeout", message: `no terminal status within ${o.timeoutMs} ms${lastError ? ` (last error: ${lastError})` : ""}` } });
}
