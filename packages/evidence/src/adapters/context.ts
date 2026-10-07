import { checkFare, type FareCheck } from "../calc/fare.js";
import { computePickupMetrics, computeRiderLocation, findCancelTs, type PickupMetrics, type RiderLocation } from "../calc/pickup.js";
import { computeRemedyBasis } from "../calc/remedy.js";
import { computeRouteMetrics, type RouteMetrics } from "../calc/route.js";
import type { IsoUtc } from "../schemas/dispute.js";
import type { RemedyBasis } from "../schemas/evidence.js";
import type { TripFixture } from "../schemas/fixture.js";
import type { PolicyDoc } from "../schemas/policy.js";

/** All deterministic computations for one fixture, computed once. */
export interface EvidenceContext {
  fixture: TripFixture;
  policy: PolicyDoc;
  route: RouteMetrics | null;
  pickup: PickupMetrics | null;
  rider: RiderLocation | null;
  cancelTs: IsoUtc | null;
  fare: FareCheck | null;
  remedy: RemedyBasis[];
}

export function buildContext(fixture: TripFixture, policy: PolicyDoc): EvidenceContext {
  const route = computeRouteMetrics(fixture, policy);
  const fare = fixture.payment.status === "available" ? checkFare(fixture.payment, route?.actualMeters ?? null) : null;
  return {
    fixture,
    policy,
    route,
    pickup: computePickupMetrics(fixture, policy),
    rider: computeRiderLocation(fixture, policy),
    cancelTs: fixture.dispute.category === "no_show" ? findCancelTs(fixture) : null,
    fare,
    remedy: computeRemedyBasis(fixture.dispute.category, fixture.payment, fare, route),
  };
}

export const provenance = (ctx: EvidenceContext, fields: string[], method: string) => ({
  source: "synthetic_fixture" as const,
  fixtureId: ctx.fixture.fixtureId,
  fields,
  method,
});
