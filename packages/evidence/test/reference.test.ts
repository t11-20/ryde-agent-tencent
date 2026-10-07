import { describe, expect, it } from "vitest";
import { buildContext } from "../src/adapters/context.js";
import { computeContactSummary } from "../src/calc/chat.js";
import { toEpochSec } from "../src/calc/time.js";
import { loadDataset } from "../src/node.js";
import type { PaymentAvailable, TripFixture } from "../src/schemas/fixture.js";

/** Reference values from handoff section 6.5. */
const ds = loadDataset();
const ctx = (id: string) => buildContext(ds.fixtures.find((f) => f.fixtureId === id) as TripFixture, ds.policy);
const items = (id: string) => {
  const p = ctx(id).fixture.payment as PaymentAvailable;
  const c = (code: string) => p.lineItems.find((i) => i.code === code)?.cents;
  return { distance: c("distance"), time: c("time"), surge: c("surge"), promo: c("promo"), total: p.totalCents };
};
const eligible = (id: string, remedyId: string) => ctx(id).remedy.find((b) => b.remedyId === remedyId)?.eligibleCents;
const arrival = (id: string) => {
  const g = ctx(id).fixture.gps;
  return g.status === "available" ? toEpochSec(g.events.find((e) => e.type === "driver_marked_arrived")!.ts) : NaN;
};

describe("section 6.5 reference values", () => {
  it("reference route", () => {
    const r = ctx("R1").route!;
    expect([r.referenceMeters, r.thresholdMeters, r.referenceDurationSec]).toEqual([7956, 796, 716]);
  });
  it("R1", () => {
    const r = ctx("R1").route!;
    expect([r.actualMeters, r.excessMeters, r.excessPct, r.actualDurationSec]).toEqual([10598, 2642, 33.2, 1134]);
    expect(r.unexpectedStops.map((s) => s.durationSec)).toEqual([180]);
    expect(r.exceedsThreshold).toBe(true);
    expect(items("R1")).toMatchObject({ distance: 795, time: 378, total: 1473 });
    expect(eligible("R1", "refund_route_excess")).toBe(198);
  });
  it("R1S", () => {
    expect(items("R1S")).toMatchObject({ surge: 737, promo: -300, total: 1910 });
    expect(eligible("R1S", "refund_route_excess")).toBe(297);
  });
  it("R2", () => {
    const r = ctx("R2").route!;
    expect([r.actualMeters, r.excessMeters, r.actualDurationSec]).toEqual([9505, 1549, 855]);
    expect(items("R2")).toMatchObject({ distance: 713, time: 285, total: 1298 });
  });
  it("R3", () => {
    const r = ctx("R3").route!;
    expect([r.actualMeters, r.excessMeters, r.actualDurationSec]).toEqual([9678, 1722, 870]);
    expect(items("R3")).toMatchObject({ distance: 726, time: 290, total: 1316 });
  });
  it("X1", () => {
    expect(items("X1")).toMatchObject({ distance: 930, time: 420, total: 1650 });
    expect(ctx("X1").route).toBeNull();
  });
  it("N1", () => {
    const c = ctx("N1");
    expect(c.pickup!.closestApproachMeters).toBe(423);
    expect(c.pickup!.checks.withinDistance).toBe(false);
    expect(c.rider).toMatchObject({ available: true, closestApproachMetersBeforeCancel: 16, withinThresholdAtCancel: true });
    expect(eligible("N1", "refund_no_show_fee")).toBe(500);
  });
  it("N2", () => {
    const c = ctx("N2");
    expect(c.pickup).toMatchObject({ closestApproachMeters: 33, waitSecondsWithinThreshold: 430, remainedWithinThreshold: true });
    const s = computeContactSummary(c.fixture, ds.policy, c.cancelTs!, c.pickup!.firstWithinThresholdTs);
    expect(s.driverAttemptsBeforeCancel).toBe(3);
    expect(c.rider).toMatchObject({ distanceAtCancelMeters: 425 });
  });
  it("N3", () => {
    const c = ctx("N3");
    expect(c.pickup!.closestApproachMeters).toBe(28);
    // DISCREPANCY (see docs/lane-b/INTEGRATION.md): section 6.5 states a 210 s wait, which assumes the
    // driver first comes within 150 m at arrival A. Under the exact section 6.1 trace builder the
    // approach ping at A-15 is 146.7 m from the pin (rounded 147 <= 150), so the spec-exact wait is 225 s.
    // waitedMinimum is false either way, and the outcome (refund 500) is unchanged.
    expect(toEpochSec(c.pickup!.firstWithinThresholdTs!)).toBe(arrival("N3") - 15);
    expect(c.pickup!.waitSecondsWithinThreshold).toBe(225);
    expect(toEpochSec(c.cancelTs!) - arrival("N3")).toBe(210);
    expect(c.pickup!.checks.waitedMinimum).toBe(false);
    const s = computeContactSummary(c.fixture, ds.policy, c.cancelTs!, c.pickup!.firstWithinThresholdTs);
    expect(s.driverAttemptsBeforeCancel).toBe(1);
    expect(c.rider!.available && toEpochSec(c.rider!.firstWithinThresholdTs!) - arrival("N3")).toBe(252);
    expect(c.rider!.available && toEpochSec(c.rider!.firstWithinThresholdTs!) > toEpochSec(c.cancelTs!)).toBe(true);
    expect(eligible("N3", "refund_no_show_fee")).toBe(500);
  });
  it("NE", () => {
    const c = ctx("NE");
    expect(c.pickup).toMatchObject({ closestApproachMeters: 150, waitSecondsWithinThreshold: 300, checks: { withinDistance: true, waitedMinimum: true } });
    const s = computeContactSummary(c.fixture, ds.policy, c.cancelTs!, c.pickup!.firstWithinThresholdTs);
    expect([s.driverAttemptsBeforeCancel, s.contactMinimumMet]).toEqual([1, true]);
    expect(c.rider).toEqual({ available: false });
  });
});
