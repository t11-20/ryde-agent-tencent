export interface LatLng { lat: number; lng: number }
const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unrounded great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const sLat = Math.sin(rad(b.lat - a.lat) / 2);
  const sLng = Math.sin(rad(b.lng - a.lng) / 2);
  const h = sLat * sLat + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * sLng * sLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
/** Distance rounded to whole metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  return Math.round(haversineMeters(a, b));
}
/** Sum of unrounded segment lengths, rounded once at the end. */
export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (previous === undefined || current === undefined) continue;
    total += haversineMeters(previous, current);
  }
  return Math.round(total);
}
/** Converts a [lat, lng] tuple from the fixture files. */
export function toLatLng(point: [number, number]): LatLng {
  return {lat: point[0], lng: point[1]};
}