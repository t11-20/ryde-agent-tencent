import type { Category } from "../schemas/dispute.js";
import type { RemedyBasis } from "../schemas/evidence.js";
import type { TripFixture } from "../schemas/fixture.js";
import type { FareCheck } from "./fare.js";
import { divHalfUp } from "./money.js";
import type { RouteMetrics } from "./route.js";

const NOT_APPLICABLE = "not applicable to category";

const unavailable = (remedyId: RemedyBasis["remedyId"], formula: string, reason: string): RemedyBasis => ({
  remedyId,
  eligibleCents: null,
  formula,
  unavailableReason: reason,
});

const ROUTE_FORMULA = "min(divHalfUp(excessMeters x perKmCents x surgeX100, 100000), divHalfUp(distanceCents x surgeX100, 100), paidCents)";
const NOSHOW_FORMULA = "min(sum of no_show_fee items, paidCents)";

/** Remedy basis consumed by Lane A's remedy validator. Order: keep_charge, refund_route_excess, refund_no_show_fee. */
export function computeRemedyBasis(
  category: Category,
  payment: TripFixture["payment"],
  fare: FareCheck | null,
  route: RouteMetrics | null,
): RemedyBasis[] {
  const keep: RemedyBasis = { remedyId: "keep_charge", eligibleCents: 0, formula: "0 (charge unchanged)" };

  let routeExcess: RemedyBasis;
  if (category !== "route_deviation") routeExcess = unavailable("refund_route_excess", ROUTE_FORMULA, NOT_APPLICABLE);
  else if (!route) routeExcess = unavailable("refund_route_excess", ROUTE_FORMULA, "GPS route metrics unavailable");
  else if (payment.status !== "available") routeExcess = unavailable("refund_route_excess", ROUTE_FORMULA, "payment record unavailable");
  else if (!fare?.arithmeticValid) routeExcess = unavailable("refund_route_excess", ROUTE_FORMULA, "fare arithmetic invalid");
  else {
    const distItems = payment.lineItems.filter((i) => i.code === "distance");
    if (distItems.length === 0) routeExcess = unavailable("refund_route_excess", ROUTE_FORMULA, "no distance line item");
    else {
      const x = payment.surgeMultiplierX100;
      const per = payment.rateCard.perKmCents;
      const distanceCents = distItems.reduce((s, i) => s + i.cents, 0);
      const byExcess = divHalfUp(route.excessMeters * per * x, 100000);
      const capDistance = divHalfUp(distanceCents * x, 100);
      const value = Math.min(byExcess, capDistance, payment.paidCents);
      routeExcess = {
        remedyId: "refund_route_excess",
        eligibleCents: value,
        formula: `min(divHalfUp(${route.excessMeters} x ${per} x ${x}, 100000) = ${byExcess}, divHalfUp(${distanceCents} x ${x}, 100) = ${capDistance}, paid ${payment.paidCents}) = ${value}`,
      };
    }
  }

  let noShow: RemedyBasis;
  if (category !== "no_show") noShow = unavailable("refund_no_show_fee", NOSHOW_FORMULA, NOT_APPLICABLE);
  else if (payment.status !== "available") noShow = unavailable("refund_no_show_fee", NOSHOW_FORMULA, "payment record unavailable");
  else if (!fare?.arithmeticValid) noShow = unavailable("refund_no_show_fee", NOSHOW_FORMULA, "fare arithmetic invalid");
  else {
    const fee = payment.lineItems.filter((i) => i.code === "no_show_fee").reduce((s, i) => s + i.cents, 0);
    const value = Math.min(fee, payment.paidCents);
    noShow = { remedyId: "refund_no_show_fee", eligibleCents: value, formula: `min(${fee}, paid ${payment.paidCents}) = ${value}` };
  }

  return [keep, routeExcess, noShow];
}
