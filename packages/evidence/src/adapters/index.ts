import type { EvidenceFamily } from "../schemas/dispute.js";
import type { EvidenceRecord, UnavailableFamily } from "../schemas/evidence.js";
import type { TripFixture } from "../schemas/fixture.js";
import type { PolicyDoc } from "../schemas/policy.js";
import { chatEvidence } from "./chat.js";
import { buildContext } from "./context.js";
import { gpsEvidence } from "./gps.js";
import { historyEvidence } from "./history.js";
import { paymentEvidence } from "./payment.js";

export { buildContext, type EvidenceContext } from "./context.js";
export { HISTORY_CAVEAT } from "./history.js";

export interface EvidenceBundle {
  fixtureId: string;
  disputeId: string;
  records: EvidenceRecord[];
  unavailable: UnavailableFamily[];
}

/** Deterministic: the same fixture and policy always produce the same IDs and facts. Order: gps, chat, payment, history. */
export function buildEvidence(fixture: TripFixture, policy: PolicyDoc): EvidenceBundle {
  const ctx = buildContext(fixture, policy);
  const parts = [gpsEvidence(ctx), chatEvidence(ctx), paymentEvidence(ctx), historyEvidence(ctx)];
  return {
    fixtureId: fixture.fixtureId,
    disputeId: fixture.dispute.id,
    records: parts.flatMap((p) => p.records),
    unavailable: parts.flatMap((p) => p.unavailable),
  };
}

export const familiesAvailable = (b: EvidenceBundle): EvidenceFamily[] =>
  (["gps", "chat", "payment", "history"] as const).filter((f) => !b.unavailable.some((u) => u.family === f));
