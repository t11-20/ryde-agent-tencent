import { describe, expect, it } from "vitest";
import { buildEvidence } from "../src/adapters/index.js";
import { parseDataset, UnknownDisputeError, DatasetIntegrityError } from "../src/dataset.js";
import { createDisputeTools, getEvidenceIndex, getRemedyBasis, listFixtures, TOOL_SPECS } from "../src/tools.js";
import { miniNoShow, policy } from "./helpers.js";

const a = miniNoShow({ distanceM: 50, waitSec: 320, attempts: 2 });
const b = { ...structuredClone(miniNoShow({ distanceM: 400, waitSec: 100, attempts: 0 })), fixtureId: "TNS2" };
b.dispute.id = "DSP-TNS2";
const ds = parseDataset({ policy, fixtures: [a, b] });

describe("createDisputeTools", () => {
  const tools = createDisputeTools(ds, "DSP-TNS");

  it("rejects unknown sources, extra keys, empty and non-object args", () => {
    for (const args of [{ sources: ["bank"] }, { sources: ["gps"], tripId: "TRP-TNS2" }, { sources: [] }, null, "gps", { sources: ["gps", "chat", "payment", "history", "gps"] }]) {
      const r = tools.get_evidence(args);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("invalid_arguments");
    }
    for (const args of [{ category: "fraud" }, { category: "no_show", disputeId: "x" }, {}]) {
      const r = tools.get_policy(args);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("invalid_arguments");
    }
  });

  it("dedupes duplicate sources", () => {
    const r = tools.get_evidence({ sources: ["gps", "gps", "chat"] });
    expect(r.ok && r.data.requested).toEqual(["gps", "chat"]);
  });

  it("throws UnknownDisputeError for an unknown dispute", () => {
    expect(() => createDisputeTools(ds, "DSP-NOPE")).toThrow(UnknownDisputeError);
    expect(() => getEvidenceIndex(ds, "DSP-NOPE")).toThrow(UnknownDisputeError);
    expect(() => getRemedyBasis(ds, "DSP-NOPE")).toThrow(UnknownDisputeError);
  });

  it("only returns records for the bound dispute", () => {
    const r = tools.get_evidence({ sources: ["gps", "chat", "payment", "history"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.disputeId).toBe("DSP-TNS");
    expect(r.data.records.length).toBeGreaterThan(0);
    expect(r.data.records.every((x) => x.provenance.fixtureId === "TNS")).toBe(true);
    expect(JSON.stringify(r.data)).not.toContain("TNS2");
    expect(r.data.notice).toMatch(/untrusted/);
  });

  it("get_policy returns the category clauses plus general clauses", () => {
    const r = tools.get_policy({ category: "no_show" });
    expect(r.ok && r.data.clauses.map((c) => c.id)).toEqual(["NS-1", "NS-2", "GEN-1", "GEN-2", "GEN-3"]);
    expect(r.ok && r.data.label).toBe("DEMONSTRATION POLICY");
  });

  it("exports JSON-schema tool specs", () => {
    expect(TOOL_SPECS.map((t) => t.name)).toEqual(["get_evidence", "get_policy"]);
    expect(JSON.stringify(TOOL_SPECS[0]?.parameters)).toContain("additionalProperties");
  });

  it("lists fixtures and indexes", () => {
    expect(listFixtures(ds).map((f) => f.disputeId)).toEqual(["DSP-TNS", "DSP-TNS2"]);
    expect(getEvidenceIndex(ds, "DSP-TNS").evidenceIds).toEqual(buildEvidence(a, policy).records.map((r) => r.id));
    expect(getRemedyBasis(ds, "DSP-TNS").find((x) => x.remedyId === "refund_no_show_fee")?.eligibleCents).toBe(500);
  });
});

describe("parseDataset", () => {
  it("rejects duplicate IDs", () => {
    expect(() => parseDataset({ policy, fixtures: [a, a] })).toThrow(DatasetIntegrityError);
    const dupMsg = structuredClone(a);
    dupMsg.comms.messages.push({ ...dupMsg.comms.messages[0]! });
    expect(() => parseDataset({ policy, fixtures: [dupMsg] })).toThrow(/duplicate message/);
  });
  it("rejects malformed fixtures", () => {
    expect(() => parseDataset({ policy, fixtures: [{ ...a, synthetic: false }] })).toThrow();
  });
});
