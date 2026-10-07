import type { IsoUtc, LatLng, Ping } from "../schemas/dispute.js";
import type { TripFixture } from "../schemas/fixture.js";
import type { PolicyDoc } from "../schemas/policy.js";
import { distanceMeters } from "./geo.js";
import { ns1Params, type Ns1Params } from "./params.js";
import { secondsBetween, toEpochSec } from "./time.js";

export interface PickupChecks {
  /** Inclusive: exactly maxPickupDistanceMeters passes. */
  withinDistance: boolean;
  /** Inclusive: exactly minWaitSeconds passes. Null when withinDistance is false. */
  waitedMinimum: boolean | null;
}

export interface PickupMetrics {
  ns1Params: Ns1Params;
  cancelTs: IsoUtc;
  markedArrivedTs: IsoUtc | null;
  closestApproachMeters: number;
  closestApproachTs: IsoUtc;
  firstWithinThresholdTs: IsoUtc | null;
  distanceAtMarkedArrivalMeters: number | null;
  waitSecondsWithinThreshold: number | null;
  remainedWithinThreshold: boolean | null;
  checks: PickupChecks;
}

export type RiderLocation =
  | { available: false }
  | {
      available: true;
      closestApproachMetersBeforeCancel: number | null;
      distanceAtCancelMeters: number;
      firstWithinThresholdTs: IsoUtc | null;
      withinThresholdAtCancel: boolean;
    };

const ll = (p: Ping): LatLng => [p.lat, p.lng];

/** Ping nearest in time to ts; ties resolve to the earlier ping. */
export function nearestInTime(pings: readonly Ping[], ts: IsoUtc): Ping | null {
  const t = toEpochSec(ts);
  let best: Ping | null = null;
  let bestD = Infinity;
  for (const p of pings) {
    const d = Math.abs(toEpochSec(p.ts) - t);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}

/** NS-1 distance check. */
export const ns1WithinDistance = (meters: number, p: Ns1Params): boolean => meters <= p.maxPickupDistanceMeters;
/** NS-1 wait check. */
export const ns1WaitedMinimum = (sec: number, p: Ns1Params): boolean => sec >= p.minWaitSeconds;
/** NS-1 contact check. */
export const ns1ContactMet = (attempts: number, p: Ns1Params): boolean => attempts >= p.minContactAttempts;

export function findCancelTs(fixture: TripFixture): IsoUtc | null {
  if (fixture.gps.status !== "available") return null;
  return fixture.gps.events.find((e) => e.type === "driver_cancelled_no_show")?.ts ?? null;
}

/** Pickup metrics for a no_show fixture with GPS and a cancellation event; otherwise null. */
export function computePickupMetrics(fixture: TripFixture, policy: PolicyDoc): PickupMetrics | null {
  if (fixture.dispute.category !== "no_show" || fixture.gps.status !== "available") return null;
  const cancelTs = findCancelTs(fixture);
  if (!cancelTs) return null;
  const params = ns1Params(policy);
  const pin: LatLng = [fixture.trip.pickup.lat, fixture.trip.pickup.lng];
  const cancel = toEpochSec(cancelTs);
  const pings = fixture.gps.driverTrace.filter((p) => toEpochSec(p.ts) <= cancel);
  if (pings.length === 0) return null;

  let closest = pings[0] as Ping;
  let closestM = distanceMeters(ll(closest), pin);
  for (const p of pings) {
    const d = distanceMeters(ll(p), pin);
    if (d < closestM) { closest = p; closestM = d; }
  }

  const firstWithinIdx = pings.findIndex((p) => ns1WithinDistance(distanceMeters(ll(p), pin), params));
  const firstWithin = firstWithinIdx >= 0 ? (pings[firstWithinIdx] as Ping) : null;
  const markedArrivedTs = fixture.gps.events.find((e) => e.type === "driver_marked_arrived")?.ts ?? null;
  const atArrival = markedArrivedTs ? nearestInTime(pings, markedArrivedTs) : null;

  const wait = firstWithin ? secondsBetween(firstWithin.ts, cancelTs) : null;
  const remained = firstWithin
    ? pings.slice(firstWithinIdx).every((p) => ns1WithinDistance(distanceMeters(ll(p), pin), params))
    : null;
  const withinDistance = firstWithin !== null;

  return {
    ns1Params: params,
    cancelTs,
    markedArrivedTs,
    closestApproachMeters: closestM,
    closestApproachTs: closest.ts,
    firstWithinThresholdTs: firstWithin?.ts ?? null,
    distanceAtMarkedArrivalMeters: atArrival ? distanceMeters(ll(atArrival), pin) : null,
    waitSecondsWithinThreshold: wait,
    remainedWithinThreshold: remained,
    checks: {
      withinDistance,
      waitedMinimum: withinDistance && wait !== null ? ns1WaitedMinimum(wait, params) : null,
    },
  };
}

/** Rider location relative to the pickup pin, for a no_show fixture with GPS. */
export function computeRiderLocation(fixture: TripFixture, policy: PolicyDoc): RiderLocation | null {
  if (fixture.dispute.category !== "no_show" || fixture.gps.status !== "available") return null;
  const cancelTs = findCancelTs(fixture);
  const trace = fixture.gps.riderTrace;
  if (!cancelTs) return null;
  if (!trace || trace.length === 0) return { available: false };
  const params = ns1Params(policy);
  const pin: LatLng = [fixture.trip.pickup.lat, fixture.trip.pickup.lng];
  const cancel = toEpochSec(cancelTs);
  const before = trace.filter((p) => toEpochSec(p.ts) <= cancel).map((p) => distanceMeters(ll(p), pin));
  const atCancel = nearestInTime(trace, cancelTs) as Ping;
  const distanceAtCancelMeters = distanceMeters(ll(atCancel), pin);
  const firstWithin = trace.find((p) => ns1WithinDistance(distanceMeters(ll(p), pin), params));
  return {
    available: true,
    closestApproachMetersBeforeCancel: before.length > 0 ? Math.min(...before) : null,
    distanceAtCancelMeters,
    firstWithinThresholdTs: firstWithin?.ts ?? null,
    withinThresholdAtCancel: ns1WithinDistance(distanceAtCancelMeters, params),
  };
}
