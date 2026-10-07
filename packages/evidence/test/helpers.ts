import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EARTH_RADIUS_M } from "../src/calc/geo.js";
import { toEpochSec, toIsoUtc } from "../src/calc/time.js";
import { PolicyDocSchema, type PolicyDoc } from "../src/schemas/policy.js";
import type { IsoUtc, Ping } from "../src/schemas/dispute.js";
import type { PaymentAvailable, TripFixture } from "../src/schemas/fixture.js";

const here = dirname(fileURLToPath(import.meta.url));
export const policy: PolicyDoc = PolicyDocSchema.parse(JSON.parse(readFileSync(join(here, "..", "data", "policy", "demo-policy.v1.json"), "utf8")));

/** Degrees of latitude that make a pure-latitude haversine distance equal `m` metres. */
export const latDegForMeters = (m: number): number => (m / EARTH_RADIUS_M) * (180 / Math.PI);

const T0 = "2026-01-01T00:00:00Z";
const at = (s: number): IsoUtc => toIsoUtc(toEpochSec(T0) + s);

export const noShowPayment = (): PaymentAvailable => ({
  status: "available", currency: "SGD", rateCard: { baseCents: 300, perKmCents: 75, perMinCents: 20, noShowFeeCents: 500 }, surgeMultiplierX100: 100,
  lineItems: [{ code: "no_show_fee", label: "No-show fee", cents: 500 }], totalCents: 500, paidCents: 500, paidAt: at(10000),
});

export const routePayment = (): PaymentAvailable => ({
  status: "available", currency: "SGD", rateCard: { baseCents: 300, perKmCents: 75, perMinCents: 20, noShowFeeCents: 500 }, surgeMultiplierX100: 150,
  lineItems: [
    { code: "base", label: "Base fare", cents: 300 },
    { code: "distance", label: "Distance", cents: 795, quantity: 10598, unit: "m" },
    { code: "time", label: "Time", cents: 378, quantity: 1134, unit: "s" },
    { code: "surge", label: "Surge x1.50", cents: 737 },
    { code: "promo", label: "Promo DEMO300", cents: -300 },
  ],
  totalCents: 1910, paidCents: 1910, paidAt: at(2000),
});

/**
 * Minimal synthetic no-show fixture: pin at (0,0); driver approaches from 1 km north,
 * reaches `distanceM` north of the pin at t=60 and waits `waitSec` before cancelling.
 * `attempts` driver messages are sent after arrival, before cancellation.
 */
export function miniNoShow(opts: { distanceM: number; waitSec: number; attempts: number }): TripFixture {
  const d = latDegForMeters(opts.distanceM);
  const pings: Ping[] = [
    { ts: at(0), lat: latDegForMeters(1000), lng: 0 },
    { ts: at(60), lat: d, lng: 0 },
    { ts: at(60 + opts.waitSec), lat: d, lng: 0 },
  ];
  return {
    fixtureId: "TNS", label: "test", purpose: "edge", synthetic: true,
    dispute: { id: "DSP-TNS", category: "no_show", tripId: "TRP-TNS", filedAt: at(9000), riderClaim: "c", driverStatement: "s" },
    parties: { riderId: "RDR-TNS", driverId: "DRV-TNS" },
    trip: { pickup: { lat: 0, lng: 0, label: "test pin" }, dropoff: null, requestedAt: at(0), outcome: "cancelled_no_show" },
    gps: {
      status: "available", driverTrace: pings,
      events: [{ ts: at(60), type: "driver_marked_arrived" }, { ts: at(60 + opts.waitSec), type: "driver_cancelled_no_show" }],
      trafficAdvisories: [],
    },
    comms: {
      messages: Array.from({ length: opts.attempts }, (_, i) => ({ id: `m${i + 1}`, ts: at(61 + i), sender: "driver" as const, text: "I'm here" })),
      calls: [],
    },
    payment: noShowPayment(),
    history: {
      rider: { partyId: "RDR-TNS", accountAgeDays: 1, rating: 5, completedTrips: 1, disputesFiled90d: 0, disputesAgainst90d: 0 },
      driver: { partyId: "DRV-TNS", accountAgeDays: 1, rating: 5, completedTrips: 1, disputesFiled90d: 0, disputesAgainst90d: 0 },
    },
  };
}
