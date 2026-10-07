import { describe, expect, it } from "vitest";
import { GOLDEN } from "../src/releaseGate.js";
import { evalRun } from "./helpers.js";

describe("per-run checks", () => {
  it.each([...GOLDEN, "R1S", "NE", "N2H", "X1", "X2", "X3"])("a perfect %s run passes every check", (id) => {
    const r = evalRun(id, "perfect");
    expect(r.checks.statusMatch.ok, r.checks.statusMatch.detail).toBe(true);
    expect(r.checks.remedyMatch.ok).toBe(true);
    expect(r.checks.amountExact.ok).toBe(true);
    expect(r.checks.citationsValid.ok).toBe(true);
    expect(r.checks.traceComplete.ok, r.checks.traceComplete.detail).toBe(true);
    expect(r.checks.noReasoningLeak.ok).toBe(true);
    expect(r.passed).toBe(true);
  });

  it("wrong amount fails amountExact only", () => {
    const r = evalRun("R1", "wrong_amount");
    expect(r.checks.amountExact).toMatchObject({ ok: false, detail: "expected 198 cents, got 199" });
    expect(r.checks.statusMatch.ok && r.checks.remedyMatch.ok && r.checks.citationsValid.ok && r.checks.traceComplete.ok).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("unknown citation fails citationsValid and names the IDs", () => {
    const r = evalRun("R1", "unknown_citation");
    expect(r.checks.citationsValid.ok).toBe(false);
    expect(r.checks.citationsValid.unknownEvidenceIds).toEqual(["GPS-ROUTE-99"]);
    expect(r.checks.citationsValid.unknownPolicyIds).toEqual(["RD-99"]);
    expect(r.passed).toBe(false);
  });

  it("missing handoff_to_judge fails traceComplete", () => {
    const r = evalRun("N2", "missing_handoff");
    expect(r.checks.traceComplete.ok).toBe(false);
    expect(r.checks.traceComplete.problems).toContain("no handoff_to_judge");
    expect(r.passed).toBe(false);
  });

  it("a <think> leak and a reasoning_content key fail noReasoningLeak", () => {
    const r = evalRun("N2", "think_leak");
    expect(r.checks.noReasoningLeak.ok).toBe(false);
    expect(r.checks.noReasoningLeak.locations).toEqual(expect.arrayContaining(["events[8].summary", "view.debug.reasoning_content"]));
    expect(r.passed).toBe(false);
  });

  it("an incomplete run that carries an amount fails", () => {
    const r = evalRun("X3", "incomplete_with_amount");
    expect(r.observedStatus).toBe("incomplete");
    expect(r.checks.statusMatch.ok).toBe(false);
    expect(r.checks.amountExact.ok).toBe(false);
    expect(r.checks.remedyMatch.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("a timed-out run fails status", () => {
    const r = evalRun("R1", "slow");
    expect(r.observedStatus).toBe("timeout");
    expect(r.checks.statusMatch.ok).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("decisive coverage is reported, not required", () => {
    const r = evalRun("R1", "perfect");
    expect(r.checks.decisiveCoverage.value).toBe(1);
    expect(evalRun("X1", "perfect").checks.decisiveCoverage.value).toBeNull();
  });

  it("traceComplete requires every available family to be retrieved", async () => {
    const { rawRun, dataset } = await import("./helpers.js");
    const { evaluateRun } = await import("../src/checks.js");
    const { fixtureFacts } = await import("../src/facts.js");
    const run = rawRun("R1", "perfect");
    const noPay = (ids?: string[]) => ids?.filter((id) => !id.startsWith("PAY-"));
    run.view!.events = run.view!.events.map((e) => (e.refs ? { ...e, refs: { evidenceIds: noPay(e.refs.evidenceIds) } } : e));
    run.view!.evidence = run.view!.evidence!.filter((r) => r.family !== "payment");
    const r = evaluateRun(run, fixtureFacts(dataset, "R1"));
    expect(r.checks.traceComplete.problems).toContain("available families never retrieved: payment");
    // X1 has no GPS: not retrieving it is fine.
    expect(evaluateRun(rawRun("X1", "perfect"), fixtureFacts(dataset, "X1")).checks.traceComplete.ok).toBe(true);
  });
});
