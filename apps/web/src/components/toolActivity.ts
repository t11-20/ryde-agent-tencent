import type { ActivityEvent } from "../contracts/provisional";

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Human-readable tool call from an event's `data` (defensive: shape is not guaranteed). */
export function describeToolRequest(e: ActivityEvent): string {
  const d = e.data;
  if (!isRecord(d)) return e.summary;
  const tool = typeof d.tool === "string" ? d.tool : "tool";
  const args = isRecord(d.args) ? d.args : undefined;
  if (args && Array.isArray(args.sources)) return `${tool}(${args.sources.map(String).join(", ")})`;
  if (args && typeof args.category === "string") return `${tool}(${args.category})`;
  return tool;
}

export function advocateActivity(events: readonly ActivityEvent[], actor: string): { requests: string[]; retrievedIds: string[]; retrievedPolicyIds: string[] } {
  const mine = events.filter((e) => e.actor === actor);
  return {
    requests: mine.filter((e) => e.type === "tool_requested").map(describeToolRequest),
    retrievedIds: [...new Set(mine.filter((e) => e.type === "tool_result").flatMap((e) => e.refs?.evidenceIds ?? []))],
    retrievedPolicyIds: [...new Set(mine.filter((e) => e.type === "tool_result").flatMap((e) => e.refs?.policyIds ?? []))],
  };
}
