import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateRun, type RawRun } from "../src/checks.js";
import { RunViewSchema } from "../src/contracts.js";
import { fixtureFacts } from "../src/facts.js";
import { dataset } from "./helpers.js";

// The UI-side example responses (docs/lane-b/contracts/examples, built by apps/web) must satisfy the
// eval-side contract and checks, so both provisional mirrors agree on what Lane A should return.
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "lane-b", "contracts", "examples");
const load = (name: string): RawRun => {
  const { response } = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as { response: unknown };
  const view = RunViewSchema.parse(response);
  return { fixtureId: name.split(".")[1] as string, attempt: 1, runId: view.runId, startedAt: "", latencyMs: 6000, timedOut: false, error: null, view };
};

describe("contract examples", () => {
  it.each(["run-view.R1.completed", "run-view.N2.completed", "run-view.X1.incomplete"])("%s passes every eval check", (name) => {
    const run = load(name);
    const r = evaluateRun(run, fixtureFacts(dataset, run.fixtureId));
    const failed = Object.entries(r.checks).filter(([k, c]) => k !== "decisiveCoverage" && !(c as { ok: boolean }).ok);
    expect(failed).toEqual([]);
    expect(r.passed).toBe(true);
  });
  it.each(["run-view.R1.failed-timeout", "run-view.R1.failed-unknown-citation"])("%s parses but fails", (name) => {
    const run = load(name);
    const r = evaluateRun(run, fixtureFacts(dataset, "R1"));
    expect(r.observedStatus).toBe("failed");
    expect(r.passed).toBe(false);
  });
});
