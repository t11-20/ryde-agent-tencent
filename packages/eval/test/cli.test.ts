import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseCli, planRuns, runEval } from "../src/cli.js";
import { dataset } from "./helpers.js";
import { startFakeServer, type Behaviour, type FakeServer } from "./fakeServer.js";

let srv: FakeServer | undefined;
const dirs: string[] = [];
afterEach(async () => {
  await srv?.close();
  srv = undefined;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "fairtrip-eval-")); dirs.push(d); return d; };
const known = dataset.fixtures.map((f) => f.fixtureId);

describe("CLI", () => {
  it("parses options", () => {
    const o = parseCli(["--base-url", "http://x:1", "--fixtures", "R1,N2", "--repeat", "3", "--timeout-sec", "90", "--delay-ms", "0", "--out", "o", "--release-gate"]);
    expect(o).toMatchObject({ baseUrl: "http://x:1", fixtures: "R1,N2", repeat: 3, timeoutSec: 90, delayMs: 0, out: "o", releaseGate: true, concurrency: 1 });
    expect(() => parseCli(["--repeat", "0"])).toThrow();
    expect(() => parseCli(["--bogus"])).toThrow();
  });
  it("plans runs", () => {
    expect(planRuns("golden", 1, known).map((p) => p.fixtureId)).toEqual(["R1", "R2", "R3", "N1", "N2", "N3"]);
    expect(planRuns("all", 1, known)).toHaveLength(12);
    expect(planRuns("R1,N2", 2, known)).toEqual([
      { fixtureId: "R1", attempt: 1 }, { fixtureId: "N2", attempt: 1 }, { fixtureId: "R1", attempt: 2 }, { fixtureId: "N2", attempt: 2 },
    ]);
    const rel = planRuns("release", 1, known);
    expect(rel.filter((p) => p.fixtureId === "R1")).toHaveLength(3);
    expect(rel.filter((p) => p.fixtureId === "X3")).toHaveLength(1);
    expect(() => planRuns("R9", 1, known)).toThrow(/unknown fixture/);
  });

  it("writes scorecard.json, scorecard.md and raw runs; release gate passes on a perfect fake API", async () => {
    srv = await startFakeServer(dataset);
    const out = tmp();
    const { scorecard, dir } = await runEval({ baseUrl: srv.url, fixtures: "release", repeat: 1, timeoutSec: 5, delayMs: 0, pollMs: 5, concurrency: 1, out, releaseGate: true, label: "FAKE SERVER TEST" }, () => undefined);
    expect(existsSync(join(dir, "scorecard.json"))).toBe(true);
    expect(readdirSync(join(dir, "runs"))).toHaveLength(14);
    expect(scorecard.releaseGate?.passed).toBe(true);
    expect(scorecard.totals).toMatchObject({ runs: 14, passedRuns: 14, fixturesRun: 10, consistency: { consistent: 2, of: 2 } });
    expect(scorecard.totals.usage.modelCalls).toBe(70);
    const md = readFileSync(join(dir, "scorecard.md"), "utf8");
    expect(md).toContain("> **FAKE SERVER TEST**");
    expect(md).toContain("Release gate: PASSED");
    expect(md).toContain("| Exact monetary correctness | 14/14 (100%) |");
  });

  it("fails the release gate and reports every failure mode", async () => {
    const script: Record<string, Behaviour> = { R1: "wrong_amount", R2: "unknown_citation", R3: "missing_handoff", N1: "think_leak", X3: "incomplete_with_amount", N2: "slow" };
    srv = await startFakeServer(dataset, (id) => script[id] ?? "perfect");
    const { scorecard } = await runEval({ baseUrl: srv.url, fixtures: "R1,R2,R3,N1,N2,X3", repeat: 1, timeoutSec: 0.3, delayMs: 0, pollMs: 5, concurrency: 2, out: tmp(), releaseGate: true, label: null }, () => undefined);
    const failed = Object.fromEntries(scorecard.runs.map((r) => [r.fixtureId, Object.entries(r.checks).filter(([k, c]) => k !== "decisiveCoverage" && !(c as { ok: boolean }).ok).map(([k]) => k)]));
    expect(failed.R1).toEqual(["amountExact"]);
    expect(failed.R2).toEqual(["citationsValid"]);
    expect(failed.R3).toEqual(["traceComplete"]);
    expect(failed.N1).toEqual(["noReasoningLeak"]);
    expect(failed.X3).toEqual(expect.arrayContaining(["statusMatch", "amountExact"]));
    expect(failed.N2).toContain("statusMatch");
    expect(scorecard.totals.latencyMs.timedOut).toBe(1);
    expect(scorecard.releaseGate?.passed).toBe(false);
  });

  it("says Not measured instead of inventing numbers", async () => {
    srv = await startFakeServer(dataset);
    const { dir } = await runEval({ baseUrl: srv.url, fixtures: "R1", repeat: 1, timeoutSec: 5, delayMs: 0, pollMs: 5, concurrency: 1, out: tmp(), releaseGate: false, label: null }, () => undefined);
    const md = readFileSync(join(dir, "scorecard.md"), "utf8");
    expect(md).toContain("| Repeated-run consistency | Not measured (no fixture was repeated) |");
    expect(md).not.toContain("Release gate");
  });
});
