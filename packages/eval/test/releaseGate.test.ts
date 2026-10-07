import { describe, expect, it } from "vitest";
import { releaseGate } from "../src/releaseGate.js";
import { evalRun } from "./helpers.js";
import type { Behaviour } from "./fakeServer.js";

function suite(override: Record<string, Behaviour[]> = {}) {
  const plan: Record<string, number> = { R1: 3, N2: 3, R2: 1, R3: 1, N1: 1, N3: 1, X1: 1, X2: 1, X3: 1, N2H: 1 };
  return Object.entries(plan).flatMap(([id, n]) =>
    Array.from({ length: n }, (_, i) => evalRun(id, override[id]?.[i] ?? "perfect", i + 1)),
  );
}

describe("release gate", () => {
  it("passes for a perfect release suite", () => {
    const g = releaseGate(suite());
    expect(g.rules.filter((r) => !r.ok)).toEqual([]);
    expect(g.passed).toBe(true);
  });
  it("fails when a golden fixture never passes", () => {
    const g = releaseGate(suite({ R2: ["wrong_amount"] }));
    expect(g.passed).toBe(false);
    expect(g.rules.find((r) => r.rule.startsWith("golden R2"))?.ok).toBe(false);
  });
  it("requires 3 consecutive passes for R1 and N2", () => {
    const g = releaseGate(suite({ R1: ["perfect", "unknown_citation", "perfect"] }));
    expect(g.rules.find((r) => r.rule === "R1 passes 3 consecutive runs")).toMatchObject({ ok: false, detail: "best streak 1 of 3 runs" });
    expect(g.passed).toBe(false);
  });
  it("requires X1 and X3 to end incomplete with no amount", () => {
    const g = releaseGate(suite({ X3: ["incomplete_with_amount"] }));
    expect(g.rules.find((r) => r.rule.startsWith("X3"))?.ok).toBe(false);
  });
  it("requires X2 and N2H to keep the charge", () => {
    const g = releaseGate(suite({ X2: ["slow"] }));
    expect(g.rules.find((r) => r.rule.startsWith("X2"))?.ok).toBe(false);
  });
  it("fails on any timeout", () => {
    const g = releaseGate([...suite(), evalRun("R3", "slow", 2)]);
    expect(g.rules.find((r) => r.rule === "no run times out past 90 s")?.ok).toBe(false);
  });
  it("marks fixtures that were not run", () => {
    const g = releaseGate([evalRun("R1", "perfect")]);
    expect(g.passed).toBe(false);
    expect(g.rules.find((r) => r.rule.startsWith("golden N3"))?.detail).toBe("not run");
  });
});
