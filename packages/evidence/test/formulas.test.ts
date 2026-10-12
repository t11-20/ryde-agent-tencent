import { describe, expect, it } from 'vitest';
import {
  calculateDistanceChargeCents,
  calculateExcessPercent,
  calculateMaterialityThresholdMeters,
  calculateRouteExcessRefundCents,
  calculateSurgedDistanceCapCents,
  calculateSurgeChargeCents,
  calculateTimeChargeCents,
} from '../src/index.js';

// Every expected value below is copied from the SPEC §5.10 test-vector table.
describe('calculateDistanceChargeCents (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateDistanceChargeCents(10598, 75)).toBe(795);
    expect(calculateDistanceChargeCents(9505, 75)).toBe(713);
    expect(calculateDistanceChargeCents(12400, 75)).toBe(930);
  });
});

describe('calculateTimeChargeCents (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateTimeChargeCents(1134, 20)).toBe(378);
    expect(calculateTimeChargeCents(855, 20)).toBe(285);
    expect(calculateTimeChargeCents(1260, 20)).toBe(420);
  });
});

describe('calculateSurgeChargeCents (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateSurgeChargeCents(1473, 150)).toBe(737);
    expect(calculateSurgeChargeCents(1473, 100)).toBe(0);
  });
});

describe('calculateRouteExcessRefundCents (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateRouteExcessRefundCents(2642, 75, 100)).toBe(198);
    expect(calculateRouteExcessRefundCents(2642, 75, 150)).toBe(297);
    expect(calculateRouteExcessRefundCents(1549, 75, 100)).toBe(116);
    expect(calculateRouteExcessRefundCents(1722, 75, 100)).toBe(129);
  });
});

describe('calculateSurgedDistanceCapCents (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateSurgedDistanceCapCents(795, 100)).toBe(795);
    expect(calculateSurgedDistanceCapCents(795, 150)).toBe(1193);
  });
});

describe('calculateMaterialityThresholdMeters (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateMaterialityThresholdMeters(7956, 500, 10)).toBe(796);
    expect(calculateMaterialityThresholdMeters(4000, 500, 10)).toBe(500);
    expect(calculateMaterialityThresholdMeters(8000, 500, 10)).toBe(800);
  });
});

describe('calculateExcessPercent (SPEC §5.10)', () => {
  it('matches the test vectors', () => {
    expect(calculateExcessPercent(2642, 7956)).toBe(33.2);
    expect(calculateExcessPercent(1549, 7956)).toBe(19.5);
    expect(calculateExcessPercent(1722, 7956)).toBe(21.6);
    expect(calculateExcessPercent(0, 7956)).toBe(0);
  });
});
