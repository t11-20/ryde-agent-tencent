import { RunSchema, type ActivityEvent, type ReviewRequest, type Run } from '@fairtrip/contracts';
import { z } from 'zod';

export interface ClientOptions { baseUrl: string; pollMs: number; timeoutSec: number; fetchImpl?: typeof fetch }
export interface RawRun {
  fixtureId: string; attempt: number; runId: string | null; latencyMs: number; timedOut: boolean;
  problem: {code: 'contract_mismatch' | 'network_error' | 'timeout'; message: string} | null; run: Run | null;
  /** Set when the API retried after a first-attempt failure: the failed first attempt's run id and record. */
  retriedFrom: string | null;
  firstAttempt: Run | null;
  /** Wall time since the POST, including an automatic re-run. */
  wallMs: number;
}
const StartSchema = z.looseObject({id: z.string().min(1)});
const TERMINAL_STATUSES = new Set(['completed', 'incomplete', 'failed']);
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** The run's own duration from its first to its last event — used for a retried result's latencyMs. */
function attemptLatencyMs(run: Run): number {
  const first = run.events[0];
  const last = run.events[run.events.length - 1];
  if (first === undefined || last === undefined) return 0;
  const span = Date.parse(last.timestamp) - Date.parse(first.timestamp);
  return Number.isFinite(span) && span >= 0 ? span : 0;
}

export async function executeRun(fixtureId: string, attempt: number, options: ClientOptions): Promise<RawRun> {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');
  const started = Date.now();
  const finish = (rest: Partial<RawRun>): RawRun => ({fixtureId, attempt, runId: null, latencyMs: Date.now() - started, timedOut: false, problem: null, run: null, retriedFrom: null, firstAttempt: null, wallMs: Date.now() - started, ...rest});
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
  let retriedFrom: string | null = null;
  let firstAttempt: Run | null = null;
  while (Date.now() - started < options.timeoutSec * 1000) {
    try {
      const after = events.size ? Math.max(...events.keys()) : 0;
      const response = await doFetch(`${base}/api/runs/${encodeURIComponent(runId)}?after=${after}`);
      if (response.ok) {
        const parsed = RunSchema.safeParse(await response.json());
        if (!parsed.success) return finish({runId, run: latest, retriedFrom, firstAttempt, problem: {code: 'contract_mismatch', message: parsed.error.issues[0]?.message ?? 'invalid run'}});
        for (const event of parsed.data.events) events.set(event.sequence, event);
        latest = {...parsed.data, events: [...events.values()].sort((a, b) => a.sequence - b.sequence)};
        if (TERMINAL_STATUSES.has(latest.status)) {
          // A first-attempt failure is retried once by the API; follow the re-run and
          // report the final attempt's own duration as latencyMs, wallMs aside.
          const retryId = latest.status === 'failed' ? latest.retriedBy : undefined;
          if (retryId !== undefined && retriedFrom === null) {
            retriedFrom = runId;
            firstAttempt = latest;
            runId = retryId;
            events.clear();
            latest = null;
            continue;
          }
          return finish({runId, run: latest, retriedFrom, firstAttempt, ...(retriedFrom === null ? {} : {latencyMs: attemptLatencyMs(latest)})});
        }
      }
    } catch { /* network blip: keep polling until the timeout */ }
    await sleep(options.pollMs);
  }
  return finish({runId, run: latest, retriedFrom, firstAttempt, timedOut: true, problem: {code: 'timeout', message: `no terminal status within ${options.timeoutSec} s`}});
}

export async function reviewRun(runId: string, body: ReviewRequest, options: ClientOptions): Promise<{run: Run | null; problem: string | null}> {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');
  try {
    const response = await doFetch(`${base}/api/runs/${encodeURIComponent(runId)}/review`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    if (!response.ok) return {run: null, problem: `HTTP ${response.status}`};
    const parsed = RunSchema.safeParse(await response.json());
    if (!parsed.success) return {run: null, problem: parsed.error.issues[0]?.message ?? 'invalid run'};
    return {run: parsed.data, problem: null};
  } catch (error) {
    return {run: null, problem: error instanceof Error ? error.message : String(error)};
  }
}
