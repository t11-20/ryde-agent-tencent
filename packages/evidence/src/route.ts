import type { Fixture, PolicyParams } from './schemas.js';
import { distanceMeters, pathLengthMeters, toLatLng, type LatLng } from './geo.js';
import { calculateExcessPercent, calculateMaterialityThresholdMeters } from './formulas.js';
import { secondsBetween } from './time.js';

export interface UnexpectedStop {
  startTs: string;
  endTs: string;
  durationSec: number;
  lat: number;
  lng: number;
}

export interface RouteMetrics {
  referenceMeters: number;
  actualMeters: number;
  excessMeters: number;
  excessPct: number;
  thresholdMeters: number;
  exceedsThreshold: boolean;
  referenceDurationSec: number;
  actualDurationSec: number;
  extraDurationSec: number;
  unexpectedStops: UnexpectedStop[];
  pingCount: number;
  referenceRouteSource: string;
}

/** §5.4 threshold rule (RD-1), computed by the named formula function of SPEC §5.10. */
export function thresholdMetersFor(referenceMeters: number, params: PolicyParams): number {
  return calculateMaterialityThresholdMeters(referenceMeters, params.minExcessMeters, params.minExcessPercent);
}

/** Strict >: a detour is material only when excess exceeds the threshold. */
export function isMaterialDetour(excessMeters: number, thresholdMeters: number): boolean {
  return excessMeters > thresholdMeters;
}

/** §5.5 unexpected stops: radius 30 m, minimum 120 s, exclusion 150 m from pickup/dropoff. */
export function findUnexpectedStops(fixture: Fixture): UnexpectedStop[] {
  if (fixture.gps.status !== 'available') return [];
  const pings = fixture.gps.driverTrace;
  const pickup: LatLng = { lat: fixture.trip.pickup.lat, lng: fixture.trip.pickup.lng };
  const dropoff = fixture.trip.dropoff;

  const stops: UnexpectedStop[] = [];
  let i = 0;
  while (i < pings.length) {
    const pi = pings[i];
    if (pi === undefined) break;
    let j = i;
    while (j + 1 < pings.length) {
      const pj1 = pings[j + 1];
      if (pj1 === undefined) break;
      if (distanceMeters({ lat: pj1.lat, lng: pj1.lng }, { lat: pi.lat, lng: pi.lng }) <= 30) {
        j = j + 1;
      } else {
        break;
      }
    }
    const pj = pings[j];
    if (j > i && pj !== undefined) {
      const duration = secondsBetween(pi.ts, pj.ts);
      const distToPickup = distanceMeters({ lat: pi.lat, lng: pi.lng }, pickup);
      const distToDropoff = dropoff === null ? Infinity : distanceMeters({ lat: pi.lat, lng: pi.lng }, { lat: dropoff.lat, lng: dropoff.lng });
      if (duration >= 120 && distToPickup > 150 && distToDropoff > 150) {
        stops.push({
          startTs: pi.ts,
          endTs: pj.ts,
          durationSec: duration,
          lat: pi.lat,
          lng: pi.lng,
        });
        i = j + 1;
        continue;
      }
    }
    i = i + 1;
  }
  return stops;
}

/** §5.4 route metrics. Returns null unless category is route_deviation, GPS available, and referenceRoute is not null. */
export function routeMetrics(fixture: Fixture, params: PolicyParams): RouteMetrics | null {
  if (fixture.dispute.category !== 'route_deviation') return null;
  if (fixture.gps.status !== 'available') return null;
  if (fixture.gps.referenceRoute === null) return null;

  const referenceRoute = fixture.gps.referenceRoute;
  const referenceMeters = pathLengthMeters(referenceRoute.points.map(toLatLng));
  const actualMeters = pathLengthMeters(fixture.gps.driverTrace.map(p => ({ lat: p.lat, lng: p.lng })));
  const excessMeters = Math.max(0, actualMeters - referenceMeters);
  const excessPct = calculateExcessPercent(excessMeters, referenceMeters);
  const thresholdMeters = thresholdMetersFor(referenceMeters, params);
  const exceedsThreshold = isMaterialDetour(excessMeters, thresholdMeters);
  const referenceDurationSec = referenceRoute.estDurationSec;

  let actualDurationSec: number;
  if (fixture.trip.startedAt !== null && fixture.trip.endedAt !== null) {
    actualDurationSec = secondsBetween(fixture.trip.startedAt, fixture.trip.endedAt);
  } else {
    const pings = fixture.gps.driverTrace;
    const first = pings[0];
    const last = pings[pings.length - 1];
    if (first === undefined || last === undefined) {
      actualDurationSec = 0;
    } else {
      actualDurationSec = secondsBetween(first.ts, last.ts);
    }
  }

  const extraDurationSec = Math.max(0, actualDurationSec - referenceDurationSec);
  const unexpectedStops = findUnexpectedStops(fixture);
  const pingCount = fixture.gps.driverTrace.length;
  const referenceRouteSource = referenceRoute.source;

  return {
    referenceMeters,
    actualMeters,
    excessMeters,
    excessPct,
    thresholdMeters,
    exceedsThreshold,
    referenceDurationSec,
    actualDurationSec,
    extraDurationSec,
    unexpectedStops,
    pingCount,
    referenceRouteSource,
  };
}
