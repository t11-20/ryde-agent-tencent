import { describe, expect, it } from 'vitest';
import {
  findFixture,
  isWithinPickupDistance,
  loadDataset,
  meetsMinimumWait,
  pickupMetrics,
} from '../src/index.js';
import type { PolicyParams } from '../src/index.js';

const params: PolicyParams = loadDataset().policy.params;

describe('isWithinPickupDistance (SPEC §5.6)', () => {
  it('returns true for 150 m (boundary)', () => {
    expect(isWithinPickupDistance(150, params)).toBe(true);
  });
  it('returns false for 151 m', () => {
    expect(isWithinPickupDistance(151, params)).toBe(false);
  });
});

describe('meetsMinimumWait (SPEC §5.6)', () => {
  it('returns true for 300 s (boundary)', () => {
    expect(meetsMinimumWait(300, params)).toBe(true);
  });
  it('returns false for 299 s', () => {
    expect(meetsMinimumWait(299, params)).toBe(false);
  });
});

describe('pickupMetrics golden values (SPEC §7)', () => {
  const ds = loadDataset();

  it('N1 matches all golden numbers', () => {
    const f = findFixture(ds, 'N1');
    if (f === undefined) throw new Error('N1 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(414);
    expect(m.closestApproachTs).toBe('2026-10-03T08:01:58Z');
    expect(m.firstWithinThresholdTs).toBeNull();
    expect(m.waitSecondsWithinThreshold).toBeNull();
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T08:01:58Z');
    expect(m.cancelledAt).toBe('2026-10-03T08:07:58Z');
    expect(m.checks.withinDistance).toBe(false);
    expect(m.checks.waitedMinimum).toBe(false);
  });

  it('N2 matches all golden numbers', () => {
    const f = findFixture(ds, 'N2');
    if (f === undefined) throw new Error('N2 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(31);
    expect(m.closestApproachTs).toBe('2026-10-03T09:02:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-03T09:02:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(430);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T09:02:44Z');
    expect(m.cancelledAt).toBe('2026-10-03T09:09:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('N2H matches all golden numbers', () => {
    const f = findFixture(ds, 'N2H');
    if (f === undefined) throw new Error('N2H not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(31);
    expect(m.closestApproachTs).toBe('2026-10-03T09:42:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-03T09:42:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(430);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T09:42:44Z');
    expect(m.cancelledAt).toBe('2026-10-03T09:49:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('N3 matches all golden numbers', () => {
    const f = findFixture(ds, 'N3');
    if (f === undefined) throw new Error('N3 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(24);
    expect(m.closestApproachTs).toBe('2026-10-03T10:22:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-03T10:22:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(210);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T10:22:44Z');
    expect(m.cancelledAt).toBe('2026-10-03T10:26:14Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(false);
  });

  it('X2 matches all golden numbers', () => {
    const f = findFixture(ds, 'X2');
    if (f === undefined) throw new Error('X2 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(31);
    expect(m.closestApproachTs).toBe('2026-10-03T11:02:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-03T11:02:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(430);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T11:02:44Z');
    expect(m.cancelledAt).toBe('2026-10-03T11:09:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('X3 matches all golden numbers', () => {
    const f = findFixture(ds, 'X3');
    if (f === undefined) throw new Error('X3 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(31);
    expect(m.closestApproachTs).toBe('2026-10-03T11:42:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-03T11:42:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(430);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-03T11:42:44Z');
    expect(m.cancelledAt).toBe('2026-10-03T11:49:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('N1R matches all golden numbers (same trip as N1)', () => {
    const f = findFixture(ds, 'N1R');
    if (f === undefined) throw new Error('N1R not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(414);
    expect(m.closestApproachTs).toBe('2026-10-04T08:01:58Z');
    expect(m.firstWithinThresholdTs).toBeNull();
    expect(m.waitSecondsWithinThreshold).toBeNull();
    expect(m.driverMarkedArrivedAt).toBe('2026-10-04T08:01:58Z');
    expect(m.cancelledAt).toBe('2026-10-04T08:07:58Z');
    expect(m.checks.withinDistance).toBe(false);
    expect(m.checks.waitedMinimum).toBe(false);
  });

  it.each(['N4', 'N5', 'X6'])('%s matches all golden numbers (same trip as N2)', (id) => {
    const f = findFixture(ds, id);
    if (f === undefined) throw new Error(`${id} not found`);
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(31);
    expect(m.closestApproachTs).toBe('2026-10-04T09:02:44Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-04T09:02:44Z');
    expect(m.waitSecondsWithinThreshold).toBe(430);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-04T09:02:44Z');
    expect(m.cancelledAt).toBe('2026-10-04T09:09:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('N6 matches all golden numbers (boundary: 145 m, exactly 300 s)', () => {
    const f = findFixture(ds, 'N6');
    if (f === undefined) throw new Error('N6 not found');
    const m = pickupMetrics(f, params);
    expect(m).not.toBeNull();
    if (m === null) return;

    expect(m.closestApproachMeters).toBe(145);
    expect(m.closestApproachTs).toBe('2026-10-04T09:04:54Z');
    expect(m.firstWithinThresholdTs).toBe('2026-10-04T09:04:54Z');
    expect(m.waitSecondsWithinThreshold).toBe(300);
    expect(m.driverMarkedArrivedAt).toBe('2026-10-04T09:04:54Z');
    expect(m.cancelledAt).toBe('2026-10-04T09:09:54Z');
    expect(m.checks.withinDistance).toBe(true);
    expect(m.checks.waitedMinimum).toBe(true);
  });

  it('returns null for R1 (wrong category)', () => {
    const f = findFixture(ds, 'R1');
    if (f === undefined) throw new Error('R1 not found');
    expect(pickupMetrics(f, params)).toBeNull();
  });

  it('returns null for X5 (GPS unavailable)', () => {
    const f = findFixture(ds, 'X5');
    if (f === undefined) throw new Error('X5 not found');
    expect(pickupMetrics(f, params)).toBeNull();
  });
});
