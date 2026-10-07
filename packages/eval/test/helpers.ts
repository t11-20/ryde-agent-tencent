import { loadDataset } from "@fairtrip/evidence/node";
import type { RawRun } from "../src/checks.js";
import { evaluateRun } from "../src/checks.js";
import { fixtureFacts } from "../src/facts.js";
import { scriptedView, type Behaviour } from "./fakeServer.js";

export const dataset = loadDataset();

export function rawRun(fixtureId: string, behaviour: Behaviour, attempt = 1): RawRun {
  const view = scriptedView(dataset, fixtureId, `r-${fixtureId}-${attempt}`, behaviour);
  const timedOut = behaviour === "slow";
  return {
    fixtureId, attempt, runId: view.runId, startedAt: "2026-10-07T00:00:00.000Z", latencyMs: timedOut ? 90_001 : 4000, timedOut,
    error: timedOut ? { code: "timeout", message: "t" } : null, view,
  };
}

export const evalRun = (fixtureId: string, behaviour: Behaviour, attempt = 1) =>
  evaluateRun(rawRun(fixtureId, behaviour, attempt), fixtureFacts(dataset, fixtureId));
