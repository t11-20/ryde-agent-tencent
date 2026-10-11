import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  divHalfUp,
  findFixture,
  formatSgd,
  haversineMeters,
  loadDataset,
  pathLengthMeters,
  secondsBetween,
  toEpochSeconds,
  toLatLng
} from '../src/index.js';

describe('geo helpers (SPEC §5.1)', () => {
  it('computes haversine distance along a meridian within 1 m of 111195', () => {
    const meters = haversineMeters({lat: 0, lng: 0}, {lat: 1, lng: 0});
    expect(Math.abs(meters - 111195)).toBeLessThanOrEqual(1);
  });

  it('returns an integer from distanceMeters', () => {
    const meters = distanceMeters({lat: 0, lng: 0}, {lat: 1, lng: 0});
    expect(Number.isInteger(meters)).toBe(true);
  });

  it('measures the R1 reference route as 7956 m', () => {
    const r1 = findFixture(loadDataset(), 'R1');
    if (!r1 || r1.gps.status !== 'available' || !r1.gps.referenceRoute) throw new Error('R1 gps missing');
    const points = r1.gps.referenceRoute.points.map(toLatLng);
    expect(pathLengthMeters(points)).toBe(7956);
  });

  it('measures a single-point path as 0 m', () => {
    expect(pathLengthMeters([{lat: 1, lng: 103}, {lat: 1.2, lng: 103.4}])).toBeGreaterThan(0);
    expect(pathLengthMeters([])).toBe(0);
    expect(pathLengthMeters([{lat: 1.3, lng: 103.7}])).toBe(0);
  });
});

describe('money helpers (SPEC §5.2)', () => {
  it('passes every divHalfUp vector', () => {
    expect(divHalfUp(1000 * 75 * 150, 100000)).toBe(113);
    expect(divHalfUp(2000 * 75 * 100, 100000)).toBe(150);
    expect(divHalfUp(75 * 100, 100000)).toBe(0);
    expect(divHalfUp(2642 * 75 * 100, 100000)).toBe(198);
    expect(divHalfUp(2642 * 75 * 150, 100000)).toBe(297);
    expect(divHalfUp(79560, 100)).toBe(796);
  });

  it('throws for invalid divHalfUp arguments', () => {
    expect(() => divHalfUp(-1, 5)).toThrow();
    expect(() => divHalfUp(1.5, 5)).toThrow();
    expect(() => divHalfUp(5, 0)).toThrow();
  });

  it('passes every formatSgd vector', () => {
    expect(formatSgd(198)).toBe('S$1.98');
    expect(formatSgd(0)).toBe('S$0.00');
    expect(formatSgd(5)).toBe('S$0.05');
    expect(formatSgd(1910)).toBe('S$19.10');
    expect(formatSgd(-300)).toBe('-S$3.00');
  });
});

describe('time helpers (SPEC §5.3)', () => {
  it('computes secondsBetween', () => {
    expect(secondsBetween('2026-10-02T11:05:00Z', '2026-10-02T11:23:54Z')).toBe(1134);
  });

  it('throws for an invalid timestamp', () => {
    expect(() => toEpochSeconds('not a date')).toThrow();
  });
});