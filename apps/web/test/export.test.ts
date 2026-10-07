import { describe, expect, it } from "vitest";
import { buildExport, exportFileName } from "../src/components/exportRun";
import type { RunState } from "../src/state/useRun";
import { ev } from "./fakes";

describe("trace export", () => {
  it("contains the full case and trace", () => {
    const state: RunState = {
      status: "incomplete", runId: "run-7", fixtureId: "X1", stalled: false, events: [ev("run-7", 1, "run_incomplete")],
      view: { runId: "run-7", status: "incomplete", events: [], missingEvidence: [{ family: "gps", reason: "none" }], usage: { modelCalls: 4 } },
    };
    const out = buildExport(state, "mock", new Date("2026-10-07T00:00:00Z"));
    expect(exportFileName(state)).toBe("fairtrip-X1-run-7.json");
    expect(Object.keys(out).sort()).toEqual(
      ["cases", "dispute", "error", "events", "evidence", "exportedAt", "fixtureId", "mismatch", "missingEvidence", "mode", "policyClauses", "result", "runId", "status", "usage"].sort(),
    );
    expect(out).toMatchObject({ mode: "mock", status: "incomplete", exportedAt: "2026-10-07T00:00:00.000Z", missingEvidence: [{ family: "gps" }], usage: { modelCalls: 4 } });
    expect(out.events).toHaveLength(1);
  });
});
