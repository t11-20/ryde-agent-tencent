import type { Fixture, PolicyParams } from './schemas.js';
import { distanceMeters } from './geo.js';
import { secondsBetween, toEpochSeconds } from './time.js';

export interface PickupMetrics {
  pickupLabel: string;
  closestApproachMeters: number;
  closestApproachTs: string;
  firstWithinThresholdTs: string | null;
  waitSecondsWithinThreshold: number | null;
  driverMarkedArrivedAt: string | null;
  cancelledAt: string;
  maxPickupDistanceMeters: number;
  minWaitSeconds: number;
  checks: { withinDistance: boolean; waitedMinimum: boolean };
}

/** <= max: exactly 150 m passes. */
export function isWithinPickupDistance(meters: number, params: PolicyParams): boolean {
  return meters <= params.maxPickupDistanceMeters;
}

/** >= min: exactly 300 s passes. */
export function meetsMinimumWait(seconds: number, params: PolicyParams): boolean {
  return seconds >= params.minWaitSeconds;
}

/** §5.6 pickup metrics. Returns null unless category is no_show and GPS available. Throws if cancelledAt is null. */
export function pickupMetrics(fixture: Fixture, params: PolicyParams): PickupMetrics | null {
  if (fixture.dispute.category !== 'no_show') return null;
  if (fixture.gps.status !== 'available') return null;
  if (fixture.trip.cancelledAt === null) throw new Error('pickupMetrics: trip.cancelledAt is null');

  const cancel = fixture.trip.cancelledAt;
  const cancelSecs = toEpochSeconds(cancel);
  const pickup = { lat: fixture.trip.pickup.lat, lng: fixture.trip.pickup.lng };

  // Pings with ts <= cancel, in file order
  const before = fixture.gps.driverTrace.filter(p => toEpochSeconds(p.ts) <= cancelSecs);

  // Closest approach: minimum distance to pickup, first ping reaching it
  let closestApproachMeters = Infinity;
  let closestApproachTs = '';
  for (const ping of before) {
    const d = distanceMeters({ lat: ping.lat, lng: ping.lng }, pickup);
    if (d < closestApproachMeters) {
      closestApproachMeters = d;
      closestApproachTs = ping.ts;
    }
  }
  if (before.length === 0) {
    closestApproachMeters = 0;
  }

  // First within threshold
  let firstWithinThresholdTs: string | null = null;
  for (const ping of before) {
    const d = distanceMeters({ lat: ping.lat, lng: ping.lng }, pickup);
    if (d <= params.maxPickupDistanceMeters) {
      firstWithinThresholdTs = ping.ts;
      break;
    }
  }

  let waitSecondsWithinThreshold: number | null = null;
  if (firstWithinThresholdTs !== null) {
    waitSecondsWithinThreshold = secondsBetween(firstWithinThresholdTs, cancel);
  }

  const withinDistance = firstWithinThresholdTs !== null;
  const waitedMinimum = withinDistance && waitSecondsWithinThreshold !== null && meetsMinimumWait(waitSecondsWithinThreshold, params);

  return {
    pickupLabel: fixture.trip.pickup.label,
    closestApproachMeters: closestApproachMeters === Infinity ? 0 : closestApproachMeters,
    closestApproachTs,
    firstWithinThresholdTs,
    waitSecondsWithinThreshold,
    driverMarkedArrivedAt: fixture.trip.driverMarkedArrivedAt,
    cancelledAt: cancel,
    maxPickupDistanceMeters: params.maxPickupDistanceMeters,
    minWaitSeconds: params.minWaitSeconds,
    checks: { withinDistance, waitedMinimum },
  };
}
