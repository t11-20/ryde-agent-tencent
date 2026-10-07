import { computeContactSummary, tagMessage, TAG_METHOD } from "../calc/chat.js";
import { toEpochSec } from "../calc/time.js";
import { seqId } from "../format.js";
import type { EvidenceRecord, UnavailableFamily } from "../schemas/evidence.js";
import { provenance, type EvidenceContext } from "./context.js";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function chatEvidence(ctx: EvidenceContext): { records: EvidenceRecord[]; unavailable: UnavailableFamily[] } {
  const { fixture, cancelTs } = ctx;
  const records: EvidenceRecord[] = [];
  const byTime = <T extends { ts: string; id: string }>(xs: readonly T[]): T[] =>
    xs.slice().sort((a, b) => toEpochSec(a.ts) - toEpochSec(b.ts) || a.id.localeCompare(b.id));

  byTime(fixture.comms.messages).forEach((m, i) => {
    const tags = tagMessage(m.sender, m.text);
    let relativeToCancel: { offsetSec: number; position: "before" | "at" | "after" } | null = null;
    if (fixture.dispute.category === "no_show" && cancelTs) {
      const off = toEpochSec(m.ts) - toEpochSec(cancelTs);
      relativeToCancel = { offsetSec: off, position: off < 0 ? "before" : off === 0 ? "at" : "after" };
    }
    records.push({
      id: seqId("CHAT", i + 1),
      family: "chat",
      kind: "chat_message",
      timestamp: m.ts,
      summary: `${cap(m.sender)} message at ${m.ts} (untrusted text): ${JSON.stringify(m.text)}${tags.length ? ` [hints: ${tags.join(", ")}]` : ""}`,
      facts: { messageId: m.id, sender: m.sender, text: m.text, tags, tagMethod: TAG_METHOD, untrusted: true, ...(fixture.dispute.category === "no_show" ? { relativeToCancel } : {}) },
      provenance: provenance(ctx, [`comms.messages[id=${m.id}]`], "verbatim passthrough; tags are keyword heuristics"),
    });
  });

  byTime(fixture.comms.calls).forEach((c, i) => {
    records.push({
      id: seqId("CALL", i + 1),
      family: "chat",
      kind: "call_log",
      timestamp: c.ts,
      summary: `Call ${c.from} -> ${c.to} at ${c.ts}, ${c.durationSec} s, ${c.answered ? "answered" : "not answered"}.`,
      facts: { callId: c.id, from: c.from, to: c.to, durationSec: c.durationSec, answered: c.answered },
      provenance: provenance(ctx, [`comms.calls[id=${c.id}]`], "call log passthrough"),
    });
  });

  if (fixture.dispute.category === "no_show") {
    if (cancelTs) {
      const s = computeContactSummary(fixture, ctx.policy, cancelTs, ctx.pickup?.firstWithinThresholdTs ?? null);
      records.push({
        id: "CHAT-CONTACT",
        family: "chat",
        kind: "contact_summary",
        timestamp: cancelTs,
        summary:
          `Driver made ${s.driverAttemptsBeforeCancel} contact attempt${s.driverAttemptsBeforeCancel === 1 ? "" : "s"} before cancelling ` +
          `(${s.driverAttemptsAfterArrivalBeforeCancel} after first coming within the pickup limit; NS-1 minimum ${s.minContactAttempts}): ${s.contactMinimumMet ? "met" : "not met"}. ` +
          `Rider sent ${s.riderMessagesBeforeCancel} message${s.riderMessagesBeforeCancel === 1 ? "" : "s"} before cancellation.`,
        facts: { ...s },
        provenance: provenance(ctx, ["comms.messages", "comms.calls", "gps.events"], "count of driver->rider messages and calls with ts < cancellation; NS-1 params from DEMONSTRATION POLICY"),
      });
    }
  }

  if (records.length === 0) return { records, unavailable: [{ family: "chat", reason: "No messages or calls were recorded for this trip." }] };
  return { records, unavailable: [] };
}
