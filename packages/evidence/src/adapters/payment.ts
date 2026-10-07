import { formatSgd } from "../calc/money.js";
import type { EvidenceRecord, UnavailableFamily } from "../schemas/evidence.js";
import { provenance, type EvidenceContext } from "./context.js";

const safeSgd = (c: number): string => (Number.isSafeInteger(c) ? formatSgd(c) : `${c} (invalid)`);

export function paymentEvidence(ctx: EvidenceContext): { records: EvidenceRecord[]; unavailable: UnavailableFamily[] } {
  const { fixture } = ctx;
  const pay = fixture.payment;
  if (pay.status !== "available" || !ctx.fare) {
    return { records: [], unavailable: [{ family: "payment", reason: pay.status === "unavailable" ? pay.reason : "Payment record unavailable." }] };
  }
  const fare = ctx.fare;
  const items = pay.lineItems.map((li) => `${li.label} ${safeSgd(li.cents)}`).join(", ");
  const records: EvidenceRecord[] = [
    {
      id: "PAY-FARE",
      family: "payment",
      kind: "fare_breakdown",
      timestamp: pay.paidAt,
      summary:
        `Fare ${safeSgd(pay.totalCents)} (${items}); paid ${safeSgd(pay.paidCents)}. ` +
        (fare.arithmeticValid ? "Arithmetic valid." : `Arithmetic INVALID: ${fare.arithmeticAnomalies.length} anomal${fare.arithmeticAnomalies.length === 1 ? "y" : "ies"}.`) +
        (fare.observations.notes.length ? ` ${fare.observations.notes.join(" ")}` : ""),
      facts: {
        currency: pay.currency,
        rateCard: { ...pay.rateCard },
        surgeMultiplierX100: pay.surgeMultiplierX100,
        lineItems: pay.lineItems.map((li) => ({ ...li })),
        totalCents: pay.totalCents,
        paidCents: pay.paidCents,
        paidAt: pay.paidAt,
        arithmeticValid: fare.arithmeticValid,
        arithmeticAnomalies: [...fare.arithmeticAnomalies],
        observations: { ...fare.observations, notes: [...fare.observations.notes] },
      },
      provenance: provenance(ctx, ["payment"], "integer-cent re-computation with divHalfUp against the rate card"),
    },
    {
      id: "PAY-REMEDY",
      family: "payment",
      kind: "remedy_basis",
      timestamp: null,
      summary:
        "Eligible amounts: " +
        ctx.remedy.map((b) => `${b.remedyId} ${b.eligibleCents === null ? `unavailable (${b.unavailableReason})` : formatSgd(b.eligibleCents)}`).join("; ") +
        ".",
      facts: { basis: ctx.remedy.map((b) => ({ ...b })) },
      provenance: provenance(ctx, ["payment", "gps.driverTrace", "gps.referenceRoute"], "RD-2 / NS-2 formulas with divHalfUp; capped at the distance charge and the amount paid"),
    },
  ];
  return { records, unavailable: [] };
}
