import type { EvidenceRecord, UnavailableFamily } from "../schemas/evidence.js";
import type { PartyHistory } from "../schemas/fixture.js";
import { provenance, type EvidenceContext } from "./context.js";

export const HISTORY_CAVEAT = "Context only. Cannot establish fault (GEN-2)." as const;

function rec(ctx: EvidenceContext, side: "rider" | "driver", h: PartyHistory): EvidenceRecord {
  return {
    id: side === "rider" ? "HIST-RIDER" : "HIST-DRIVER",
    family: "history",
    kind: "party_history",
    timestamp: null,
    summary:
      `${side === "rider" ? "Rider" : "Driver"} ${h.partyId}: account ${h.accountAgeDays} days, rating ${h.rating}, ${h.completedTrips} completed trips, ` +
      `${h.disputesFiled90d} disputes filed and ${h.disputesAgainst90d} against in 90 days. ${HISTORY_CAVEAT}`,
    facts: { ...h, caveat: HISTORY_CAVEAT },
    provenance: provenance(ctx, [`history.${side}`], "profile passthrough"),
  };
}

export function historyEvidence(ctx: EvidenceContext): { records: EvidenceRecord[]; unavailable: UnavailableFamily[] } {
  return { records: [rec(ctx, "rider", ctx.fixture.history.rider), rec(ctx, "driver", ctx.fixture.history.driver)], unavailable: [] };
}
