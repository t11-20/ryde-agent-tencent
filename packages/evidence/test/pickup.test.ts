import { describe, expect, it } from "vitest";
import { computeContactSummary } from "../src/calc/chat.js";
import { ns1Params } from "../src/calc/params.js";
import { computePickupMetrics, ns1ContactMet, ns1WaitedMinimum, ns1WithinDistance } from "../src/calc/pickup.js";
import { miniNoShow, policy } from "./helpers.js";

describe("NS-1 boundaries (params read from the DEMONSTRATION POLICY)", () => {
  const p = ns1Params(policy);
  it("reads params from the policy file", () => {
    expect(p).toEqual({ maxPickupDistanceMeters: 150, minWaitSeconds: 300, minContactAttempts: 1 });
  });
  it("150 m is within, 151 m is not", () => {
    expect(ns1WithinDistance(150, p)).toBe(true);
    expect(ns1WithinDistance(151, p)).toBe(false);
    expect(computePickupMetrics(miniNoShow({ distanceM: 150, waitSec: 400, attempts: 1 }), policy)?.checks.withinDistance).toBe(true);
    const far = computePickupMetrics(miniNoShow({ distanceM: 151, waitSec: 400, attempts: 1 }), policy);
    expect(far?.checks).toEqual({ withinDistance: false, waitedMinimum: null });
    expect(far?.waitSecondsWithinThreshold).toBeNull();
    expect(far?.remainedWithinThreshold).toBeNull();
  });
  it("a 300 s wait meets the minimum, 299 s does not", () => {
    expect(ns1WaitedMinimum(300, p)).toBe(true);
    expect(ns1WaitedMinimum(299, p)).toBe(false);
    expect(computePickupMetrics(miniNoShow({ distanceM: 50, waitSec: 300, attempts: 1 }), policy)?.checks.waitedMinimum).toBe(true);
    expect(computePickupMetrics(miniNoShow({ distanceM: 50, waitSec: 299, attempts: 1 }), policy)?.checks.waitedMinimum).toBe(false);
  });
  it("0 contact attempts fails", () => {
    expect(ns1ContactMet(0, p)).toBe(false);
    expect(ns1ContactMet(1, p)).toBe(true);
    const f = miniNoShow({ distanceM: 50, waitSec: 300, attempts: 0 });
    const m = computePickupMetrics(f, policy);
    const s = computeContactSummary(f, policy, m!.cancelTs, m!.firstWithinThresholdTs);
    expect(s.driverAttemptsBeforeCancel).toBe(0);
    expect(s.contactMinimumMet).toBe(false);
  });
  it("only counts attempts strictly before the cancellation", () => {
    const f = miniNoShow({ distanceM: 50, waitSec: 300, attempts: 1 });
    f.comms.messages.push({ id: "m9", ts: f.gps.status === "available" ? f.gps.events[1]!.ts : "", sender: "driver", text: "cancelled" });
    const m = computePickupMetrics(f, policy)!;
    expect(computeContactSummary(f, policy, m.cancelTs, m.firstWithinThresholdTs).driverAttemptsBeforeCancel).toBe(1);
  });
});
