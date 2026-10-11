// Every money and threshold formula in one place. Inputs are integers; every division uses divHalfUp.
import { divHalfUp } from './money.js';

/** Distance charge: billed metres x per-km rate / 1000, rounded half up. */
export function calculateDistanceChargeCents(meters: number, perKmCents: number): number {
  return divHalfUp(meters * perKmCents, 1000);
}
/** Time charge: billed seconds x per-minute rate / 60, rounded half up. */
export function calculateTimeChargeCents(seconds: number, perMinCents: number): number {
  return divHalfUp(seconds * perMinCents, 60);
}
/** Surge charge on the pre-surge subtotal (base + distance + time): subtotal x (surgeX100 - 100) / 100. */
export function calculateSurgeChargeCents(preSurgeCents: number, surgeMultiplierX100: number): number {
  return divHalfUp(preSurgeCents * (surgeMultiplierX100 - 100), 100);
}
/** RD-2 refund for excess distance: excess metres x per-km rate x surgeX100 / 100000. */
export function calculateRouteExcessRefundCents(excessMeters: number, perKmCents: number, surgeMultiplierX100: number): number {
  return divHalfUp(excessMeters * perKmCents * surgeMultiplierX100, 100000);
}
/** Cap for the RD-2 refund: the surged distance charge. */
export function calculateSurgedDistanceCapCents(distanceChargeCents: number, surgeMultiplierX100: number): number {
  return divHalfUp(distanceChargeCents * surgeMultiplierX100, 100);
}
/** RD-1 threshold: the greater of the minimum metres or the percentage of the reference distance. */
export function calculateMaterialityThresholdMeters(referenceMeters: number, minExcessMeters: number, minExcessPercent: number): number {
  return Math.max(minExcessMeters, divHalfUp(referenceMeters * minExcessPercent, 100));
}
/** Excess as a percentage of the reference distance, one decimal place. */
export function calculateExcessPercent(excessMeters: number, referenceMeters: number): number {
  return Math.round((excessMeters * 1000) / referenceMeters) / 10;
}
