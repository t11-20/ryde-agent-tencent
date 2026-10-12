import { RunSchema, type ActivityEvent, type Run } from '@fairtrip/contracts';
import { z } from 'zod';

export interface ClientOptions { baseUrl: string; pollMs: number; timeoutSec: number; fetchImpl?: typeof fetch }
export interface RawRun {
  fixtureId: string; attempt: number; runId: string | null; latencyMs: number; timedOut: boolean;
  problem: {code: 'contract_mismatch' | 'network_error' | 'timeout'; message: string} | null; run: Run | null;
}
const StartSchema = z.looseObject({id: z.string().min(1)});
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function executeRun(fixtureId: string, attempt: number, options: ClientOptions): Promise<RawRun> {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');
  const started = Date.now();
  const finish = (rest: Partial<RawRun>): RawRun => ({fixtureId, attempt, runId: null, latencyMs: Date.now() - started, timedOut: false, problem: null, run: null, ...rest});
  let runId: string;
  try {
    const response = await doFetch(`${base}/api/runs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({fixtureId})});
    if (!response.ok) return finish({problem: {code: 'network_error', message: `POST /api/runs HTTP ${response.status}`}});
    const parsed = StartSchema.safeParse(await response.json());
    if (!parsed.success) return finish({problem: {code: 'contract_mismatch', message: 'POST /api/runs: missing id'}});
    runId = parsed.data.id;
  } catch (error) {
    return finish({problem: {code: 'network_error', message: error instanceof Error ? error.message : String(error)}});
  }
  const events = new Map<number, ActivityEvent>();
  let latest: Run | null = null;
  while (Date.now() - started < options.timeoutSec * 1000) {
    try {
      const after = events.size ? Math.max(...events.keys()) : 0;
      const response = await doFetch(`${base}/api/runs/${encodeURIComponent(runId)}?after=${after}`);
      if (response.ok) {
        const parsed = RunSchema.safeParse(await response.json());
        if (!parsed.success) return finish({runId, run: latest, problem: {code: 'contract_mismatch', message: parsed.error.issues[0]?.message ?? 'invalid run'}});
        for (const event of parsed.data.events) events.set(event.sequence, event);
        latest = {...parsed.data, events: [...events.values()].sort((a, b) => a.sequence - b.sequence)};
        if (['completed', 'incomplete', 'failed'].includes(latest.status)) return finish({runId, run: latest});
      }
    } catch { /* network blip: keep polling until the timeout */ }
    await sleep(options.pollMs);
  }
  return finish({runId, run: latest, timedOut: true, problem: {code: 'timeout', message: `no terminal status within ${options.timeoutSec} s`}});
}
