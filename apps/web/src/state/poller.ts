import type { ApiClient } from "../api/client";
import { ContractMismatchError } from "../api/client";
import { isTerminal, type ActivityEvent, type RunView } from "../contracts/provisional";
import { maxSequence, mergeEvents } from "./events";

export const POLL_INTERVAL_MS = 1000;
export const MAX_CONSECUTIVE_NETWORK_ERRORS = 5;

export interface PollerCallbacks {
  /** Latest view with all events merged so far. */
  onUpdate(view: RunView, events: ActivityEvent[]): void;
  onContractMismatch(err: ContractMismatchError): void;
  /** 5 consecutive network errors: polling pauses until resume() or stop(). */
  onStalled(lastError: unknown): void;
}

export interface Poller {
  stop(): void;
  resume(): void;
  readonly stopped: boolean;
}

/**
 * Polls GET /api/runs/:id?after=<highest sequence seen> once per interval until a terminal status.
 * After stop(), no callback ever fires again (guards against showing a stale run's events).
 */
export function startPolling(client: ApiClient, runId: string, cb: PollerCallbacks, intervalMs = POLL_INTERVAL_MS): Poller {
  let stopped = false;
  let stalled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let events: ActivityEvent[] = [];
  let failures = 0;

  const schedule = (ms: number): void => {
    if (stopped || stalled) return;
    timer = setTimeout(tick, ms);
  };

  async function tick(): Promise<void> {
    if (stopped || stalled) return;
    controller = new AbortController();
    try {
      const view = await client.getRun(runId, maxSequence(events), controller.signal);
      if (stopped) return;
      if (view.runId !== runId) throw new ContractMismatchError("GET /api/runs/:id", `runId ${view.runId} does not match requested ${runId}`);
      failures = 0;
      events = mergeEvents(events, view.events.filter((e) => e.runId === runId));
      cb.onUpdate(view, events);
      if (isTerminal(view.status)) { stopped = true; return; }
      schedule(intervalMs);
    } catch (e) {
      if (stopped) return;
      if (e instanceof ContractMismatchError) { stopped = true; cb.onContractMismatch(e); return; }
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_NETWORK_ERRORS) { stalled = true; cb.onStalled(e); return; }
      schedule(intervalMs);
    }
  }

  schedule(0);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    },
    resume() {
      if (stopped || !stalled) return;
      stalled = false;
      failures = 0;
      schedule(0);
    },
    get stopped() { return stopped; },
  };
}
