import { describe, expect, it } from 'vitest';
import {
  findFixture,
  findUnexpectedStops,
  isMaterialDetour,
  loadDataset,
  routeMetrics,
  thresholdMetersFor,
} from '../src/index.js';
import type { PolicyParams } from '../src/index.js';

const params: PolicyParams = loadDataset().policy.params;

describe('thresholdMetersFor (SPEC §5.4)', () => {
  it('returns 500 for referenceMeters 4000', () => {
    expect(thresholdMetersFor(4000, params)).toBe(500);
  });
  it('returns 800 for referenceMeters 8000', () => {
    expect(thresholdMetersFor(8000, params)).toBe(800);
  });
  it('returns 796 for referenceMeters 7956', () => {
    expect(thresholdMetersFor(7956, params)).toBe(796);
  });
});

describe('isMaterialDetour (SPEC §5.4)', () => {
  it('returns false when excess equals threshold (strict >)', () => {
    expect(isMaterialDetour(500, 500)).toBe(false);
  });
  it('returns true when excess exceeds threshold by 1', () => {
    expect(isMaterialDetour(501, 500)).toBe(true);
  });
});

describe('routeMetrics golden values (SPEC §7)', () => {
  const ds = loadDataset();

  it('R1 matches all golden numbers', () => {
    const f = findFixture(ds, 'R1');
    if (f === undefined) throw new Error('R1 not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(10598);
    expect(m.excessMeters).toBe(2642);
    expect(m.excessPct).toBe(33.2);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.referenceDurationSec).toBe(716);
    expect(m.actualDurationSec).toBe(1134);
    expect(m.extraDurationSec).toBe(418);
    expect(m.pingCount).toBe(22);
    expect(m.referenceRouteSource).toBe('Synthetic reference route (not a routing-service result)');

    expect(m.unexpectedStops).toEqual([
      { startTs: '2026-10-02T11:13:58Z', endTs: '2026-10-02T11:16:58Z', durationSec: 180, lat: 1.315, lng: 103.885 },
    ]);
  });

  it('R1S matches all golden numbers', () => {
    const f = findFixture(ds, 'R1S');
    if (f === undefined) throw new Error('R1S not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(10598);
    expect(m.excessMeters).toBe(2642);
    expect(m.excessPct).toBe(33.2);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.referenceDurationSec).toBe(716);
    expect(m.actualDurationSec).toBe(1134);
    expect(m.extraDurationSec).toBe(418);
    expect(m.pingCount).toBe(22);

    expect(m.unexpectedStops.length).toBe(1);
    const stop = m.unexpectedStops[0];
    if (stop === undefined) throw new Error('no stop');
    expect(stop.startTs).toBe('2026-10-02T12:28:58Z');
    expect(stop.endTs).toBe('2026-10-02T12:31:58Z');
    expect(stop.durationSec).toBe(180);
    expect(stop.lat).toBe(1.315);
    expect(stop.lng).toBe(103.885);
  });

  it('R2 matches all golden numbers', () => {
    const f = findFixture(ds, 'R2');
    if (f === undefined) throw new Error('R2 not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(9505);
    expect(m.excessMeters).toBe(1549);
    expect(m.excessPct).toBe(19.5);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.referenceDurationSec).toBe(716);
    expect(m.actualDurationSec).toBe(855);
    expect(m.extraDurationSec).toBe(139);
    expect(m.unexpectedStops).toEqual([]);
    expect(m.pingCount).toBe(18);
  });

  it('R3 matches all golden numbers', () => {
    const f = findFixture(ds, 'R3');
    if (f === undefined) throw new Error('R3 not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(9678);
    expect(m.excessMeters).toBe(1722);
    expect(m.excessPct).toBe(21.6);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.referenceDurationSec).toBe(716);
    expect(m.actualDurationSec).toBe(870);
    expect(m.extraDurationSec).toBe(154);
    expect(m.unexpectedStops).toEqual([]);
    expect(m.pingCount).toBe(18);
  });

  it('R4 matches all golden numbers (over 500 m but not material)', () => {
    const f = findFixture(ds, 'R4');
    if (f === undefined) throw new Error('R4 not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(8603);
    expect(m.excessMeters).toBe(647);
    expect(m.excessPct).toBe(8.1);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(false);
    expect(m.referenceDurationSec).toBe(716);
    expect(m.actualDurationSec).toBe(1265);
    expect(m.extraDurationSec).toBe(549);
    expect(m.unexpectedStops).toEqual([]);
    expect(m.pingCount).toBe(24);
  });

  it('R1F matches all golden numbers (same trip as R1)', () => {
    const f = findFixture(ds, 'R1F');
    if (f === undefined) throw new Error('R1F not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.referenceMeters).toBe(7956);
    expect(m.actualMeters).toBe(10598);
    expect(m.excessMeters).toBe(2642);
    expect(m.excessPct).toBe(33.2);
    expect(m.thresholdMeters).toBe(796);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.actualDurationSec).toBe(1134);
    expect(m.extraDurationSec).toBe(418);
    expect(m.pingCount).toBe(22);
    expect(m.unexpectedStops).toEqual([
      { startTs: '2026-10-04T11:13:58Z', endTs: '2026-10-04T11:16:58Z', durationSec: 180, lat: 1.315, lng: 103.885 },
    ]);
  });

  it('X4 matches all golden numbers (same trip as R1, payment missing)', () => {
    const f = findFixture(ds, 'X4');
    if (f === undefined) throw new Error('X4 not found');
    const m = routeMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.actualMeters).toBe(10598);
    expect(m.excessMeters).toBe(2642);
    expect(m.excessPct).toBe(33.2);
    expect(m.exceedsThreshold).toBe(true);
    expect(m.actualDurationSec).toBe(1134);
    expect(m.unexpectedStops).toEqual([
      { startTs: '2026-10-04T11:13:58Z', endTs: '2026-10-04T11:16:58Z', durationSec: 180, lat: 1.315, lng: 103.885 },
    ]);
    expect(m.pingCount).toBe(22);
  });

  it('returns null for X1 (GPS unavailable)', () => {
    const f = findFixture(ds, 'X1');
    if (f === undefined) throw new Error('X1 not found');
    expect(routeMetrics(f, params)).toBeNull();
  });

  it('returns null for N2 (wrong category)', () => {
    const f = findFixture(ds, 'N2');
    if (f === undefined) throw new Error('N2 not found');
    expect(routeMetrics(f, params)).toBeNull();
  });
});

describe('findUnexpectedStops — short dwell produces no stop', () => {
  it('R1 copy with 100 s dwell has no stops', () => {
    const ds = loadDataset();
    const r1 = findFixture(ds, 'R1');
    if (r1 === undefined) throw new Error('R1 not found');
    const copy = structuredClone(r1);
    if (copy.gps.status !== 'available') throw new Error('GPS not available');
    const ping13 = copy.gps.driverTrace[13];
    if (ping13 === undefined) throw new Error('ping 13 missing');
    ping13.ts = '2026-10-02T11:15:38Z';
    expect(findUnexpectedStops(copy)).toEqual([]);
  });
});
