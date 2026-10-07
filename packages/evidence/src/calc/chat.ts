import type { IsoUtc } from "../schemas/dispute.js";
import type { Message, TripFixture } from "../schemas/fixture.js";
import type { PolicyDoc } from "../schemas/policy.js";
import { ns1Params } from "./params.js";
import { ns1ContactMet } from "./pickup.js";
import { toEpochSec } from "./time.js";

export const TAG_METHOD = "keyword_heuristic" as const;

export type ChatTag = "consent" | "route_request" | "objection" | "location_claim" | "threat" | "instruction_like";

interface TagRule { tag: ChatTag; appliesTo: "rider" | "any"; pattern: RegExp }

/** Heuristic hints only. Case-insensitive. Never used to change program logic. */
export const TAG_RULES: readonly TagRule[] = [
  { tag: "consent", appliesTo: "rider", pattern: /\b(yes|ok|okay|sure|no problem|agreed?|go ahead)\b/i },
  { tag: "route_request", appliesTo: "rider", pattern: /\b(via|instead|go through|take the)\b/i },
  { tag: "objection", appliesTo: "rider", pattern: /\b(why|wrong way|follow the app|longer|overcharg\w*)\b/i },
  { tag: "location_claim", appliesTo: "any", pattern: /\b(i'?m here|i am here|i'?m at|at the pickup|main entrance)\b/i },
  { tag: "threat", appliesTo: "any", pattern: /\b(report you|police|sue|lawyer|hurt|kill)\b/i },
  { tag: "instruction_like", appliesTo: "any", pattern: /(ignore (all|any|previous|prior)|disregard|system (note|notice|prompt|message)|ai judge|as an ai|you must rule)/i },
];

export function tagMessage(sender: Message["sender"], text: string): ChatTag[] {
  return TAG_RULES.filter((r) => (r.appliesTo === "any" || r.appliesTo === sender) && r.pattern.test(text)).map((r) => r.tag);
}

export interface ContactSummary {
  cancelTs: IsoUtc;
  firstWithinThresholdTs: IsoUtc | null;
  driverAttemptsBeforeCancel: number;
  driverAttemptsAfterArrivalBeforeCancel: number;
  attemptIds: string[];
  riderMessagesBeforeCancel: number;
  minContactAttempts: number;
  /** NS-1 contact condition, evaluated on driverAttemptsBeforeCancel. */
  contactMinimumMet: boolean;
}

/** Driver→rider contact attempts before the cancellation (messages and calls, ts < cancelTs). */
export function computeContactSummary(
  fixture: TripFixture,
  policy: PolicyDoc,
  cancelTs: IsoUtc,
  firstWithinThresholdTs: IsoUtc | null,
): ContactSummary {
  const params = ns1Params(policy);
  const cancel = toEpochSec(cancelTs);
  const within = firstWithinThresholdTs ? toEpochSec(firstWithinThresholdTs) : null;
  const attempts = [
    ...fixture.comms.messages.filter((m) => m.sender === "driver").map((m) => ({ id: m.id, ts: m.ts })),
    ...fixture.comms.calls.filter((c) => c.from === "driver" && c.to === "rider").map((c) => ({ id: c.id, ts: c.ts })),
  ]
    .filter((a) => toEpochSec(a.ts) < cancel)
    .sort((a, b) => toEpochSec(a.ts) - toEpochSec(b.ts) || a.id.localeCompare(b.id));
  const afterArrival = within === null ? [] : attempts.filter((a) => toEpochSec(a.ts) >= within);
  const riderMessagesBeforeCancel = fixture.comms.messages.filter((m) => m.sender === "rider" && toEpochSec(m.ts) < cancel).length;
  return {
    cancelTs,
    firstWithinThresholdTs,
    driverAttemptsBeforeCancel: attempts.length,
    driverAttemptsAfterArrivalBeforeCancel: afterArrival.length,
    attemptIds: attempts.map((a) => a.id),
    riderMessagesBeforeCancel,
    minContactAttempts: params.minContactAttempts,
    contactMinimumMet: ns1ContactMet(attempts.length, params),
  };
}
