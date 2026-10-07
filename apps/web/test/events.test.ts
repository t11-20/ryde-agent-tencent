import { describe, expect, it } from "vitest";
import { maxSequence, mergeEvents } from "../src/state/events";
import { ev } from "./fakes";

describe("mergeEvents", () => {
  it("dedupes by sequence and keeps sequence order", () => {
    const merged = mergeEvents([ev("r", 1), ev("r", 2)], [ev("r", 2), ev("r", 3)]);
    expect(merged.map((e) => e.sequence)).toEqual([1, 2, 3]);
  });
  it("tolerates out-of-order batches", () => {
    const merged = mergeEvents([ev("r", 4)], [ev("r", 2), ev("r", 5), ev("r", 1), ev("r", 3)]);
    expect(merged.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(maxSequence(merged)).toBe(5);
  });
  it("keeps the first copy of a duplicated sequence", () => {
    const merged = mergeEvents([ev("r", 1, "run_started")], [ev("r", 1, "tool_result")]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.type).toBe("run_started");
  });
  it("handles empty input", () => {
    expect(mergeEvents([], [])).toEqual([]);
    expect(maxSequence([])).toBe(0);
  });
});
