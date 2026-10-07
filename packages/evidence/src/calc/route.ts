import type { IsoUtc, LatLng, Ping } from "../schemas/dispute.js";
import type { GpsAvailable, TripFixture } from "../schemas/fixture.js";
import type { PolicyDoc } from "../schemas/policy.js";
import { distanceMeters, pathLengthMeters, round1 } from "./geo.js";
import { rd1Params, type Rd1Params } from "./params.js";
import { secondsBetween } from "./time.js";

/** Stop-detection constants (heuristic, not policy thresholds). */
export const STOP_RADIUS_M = 30;
export const STOP_MIN_SEC = 120;
export const STOP_ENDPOINT_EXCLUSION_M = 150;

export interface Stop { startTs: IsoUtc; endTs: IsoUtc; durationSec: number; lat: number; lng: number }

export interface RouteMetrics {
  referenceMeters: number;
  actualMeters: number;
  excessMeters: number;
  excessPct: number;
  thresholdMeters: number;
  exceedsThreshold: boolean;
  rd1Params: Rd1Params;
  tripStartTs: IsoUtc;
  tripEndTs: IsoUtc;
  actualDurationSec: number;
  referenceDurationSec: number;
  extraDurationSec: number;
  unexpectedStops: Stop[];
  referenceRouteSource: string;
}

const ll = (p: Ping): LatLng => [p.lat, p.lng];

/** RD-1 threshold: max(minExcessMeters, round(minExcessRatio × referenceMeters)). */
export function rd1ThresholdMeters(referenceMeters: number, params: Rd1Params): number {
  return Math.max(params.minExcessMeters, Math.round(params.minExcessRatio * referenceMeters));
}

/** RD-1 materiality: strict comparison. */
export function rd1Exceeds(excessMeters: number, thresholdMeters: number): boolean {
  return excessMeters > thresholdMeters;
}

/** Dwell detection; stops within `excludeRadius` of any `excludePoints` are dropped. */
export function detectStops(pings: readonly Ping[], excludePoints: readonly LatLng[] = []): Stop[] {
  const stops: Stop[] = [];
  let i = 0;
  while (i < pings.length) {
    const pi = pings[i] as Ping;
    let last = i;
    for (let j = i + 1; j < pings.length; j++) {
      if (distanceMeters(ll(pings[j] as Ping), ll(pi)) <= STOP_RADIUS_M) last = j;
      else break;
    }
    const pl = pings[last] as Ping;
    const dur = secondsBetween(pi.ts, pl.ts);
    if (dur >= STOP_MIN_SEC) {
      const nearEndpoint = excludePoints.some((e) => distanceMeters(ll(pi), e) <= STOP_ENDPOINT_EXCLUSION_M);
      if (!nearEndpoint) stops.push({ startTs: pi.ts, endTs: pl.ts, durationSec: dur, lat: pi.lat, lng: pi.lng });
      i = last + 1;
    } else {
      i += 1;
    }
  }
  return stops;
}

/** Route metrics for a route_deviation fixture with GPS and a reference route; otherwise null. */
export function computeRouteMetrics(fixture: TripFixture, policy: PolicyDoc): RouteMetrics | null {
  if (fixture.dispute.category !== "route_deviation") return null;
  if (fixture.gps.status !== "available") return null;
  const gps: GpsAvailable = fixture.gps;
  const ref = gps.referenceRoute;
  const first = gps.driverTrace[0];
  const lastPing = gps.driverTrace[gps.driverTrace.length - 1];
  if (!ref || !first || !lastPing) return null;

  const params = rd1Params(policy);
  const referenceMeters = pathLengthMeters(ref.points);
  const actualMeters = pathLengthMeters(gps.driverTrace.map(ll));
  const excessMeters = Math.max(0, actualMeters - referenceMeters);
  const excessPct = referenceMeters > 0 ? round1((excessMeters / referenceMeters) * 100) : 0;
  const thresholdMeters = rd1ThresholdMeters(referenceMeters, params);

  const tripStartTs = gps.events.find((e) => e.type === "trip_start")?.ts ?? first.ts;
  const tripEndTs = gps.events.find((e) => e.type === "trip_end")?.ts ?? lastPing.ts;
  const actualDurationSec = secondsBetween(tripStartTs, tripEndTs);
  const referenceDurationSec = ref.estDurationSec;

  const endpoints: LatLng[] = [[fixture.trip.pickup.lat, fixture.trip.pickup.lng]];
  if (fixture.trip.dropoff) endpoints.push([fixture.trip.dropoff.lat, fixture.trip.dropoff.lng]);

  return {
    referenceMeters,
    actualMeters,
    excessMeters,
    excessPct,
    thresholdMeters,
    exceedsThreshold: rd1Exceeds(excessMeters, thresholdMeters),
    rd1Params: params,
    tripStartTs,
    tripEndTs,
    actualDurationSec,
    referenceDurationSec,
    extraDurationSec: Math.max(0, actualDurationSec - referenceDurationSec),
    unexpectedStops: detectStops(gps.driverTrace, endpoints),
    referenceRouteSource: ref.source,
  };
}
