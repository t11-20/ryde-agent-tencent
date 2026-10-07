import { describe, expect, it } from "vitest";
import { buildScorecard, median, scorecardMarkdown } from "../src/scorecard.js";
import { evalRun } from "./helpers.js";

describe("scorecard", () => {
  it("computes the median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });
  it("reports Not measured for missing usage and latency", () => {
    const r = { ...evalRun("R1", "perfect"), usage: null };
    const t = { ...evalRun("R2", "slow"), usage: null };
    const sc = buildScorecard([t], { baseUrl: "http://x", label: null, options: {}, gate: null, now: new Date(0) });
    const md = scorecardMarkdown(sc);
    expect(md).toContain("| Model calls (total) | Not measured |");
    expect(md).toContain("| Latency p50 | Not measured |");
    expect(md).toContain("| Input tokens (total) | Not measured |");
    const sc2 = buildScorecard([r], { baseUrl: "http://x", label: null, options: {}, gate: null });
    expect(sc2.totals.latencyMs.p50).toBe(4000);
    expect(sc2.totals.usage.modelCalls).toBeNull();
  });
  it("flags inconsistent repeated runs", () => {
    const sc = buildScorecard([evalRun("R1", "perfect", 1), evalRun("R1", "wrong_amount", 2)], { baseUrl: "x", label: null, options: {}, gate: null });
    expect(sc.fixtures[0]?.consistent).toBe(false);
    expect(sc.totals.consistency).toEqual({ consistent: 0, of: 1 });
  });
});
