import type { LatLng } from "../schemas/dispute.js";

export const EARTH_RADIUS_M = 6371008.8;

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unrounded haversine distance in metres. Use `distanceMeters` for anything compared or output. */
export function haversineRaw(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Haversine distance rounded to whole metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  return Math.round(haversineRaw(a, b));
}

/** Sum of haversine distances over consecutive points, rounded to whole metres. */
export function pathLengthMeters(points: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineRaw(points[i - 1] as LatLng, points[i] as LatLng);
  }
  return Math.round(total);
}

/** Round to one decimal place (percentages). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
