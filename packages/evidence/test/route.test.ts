import { describe, expect, it } from "vitest";
import { rd1Params } from "../src/calc/params.js";
import { detectStops, rd1Exceeds, rd1ThresholdMeters } from "../src/calc/route.js";
import { toIsoUtc } from "../src/calc/time.js";
import type { Ping } from "../src/schemas/dispute.js";
import { latDegForMeters, policy } from "./helpers.js";

describe("RD-1 boundaries (params read from the DEMONSTRATION POLICY)", () => {
  const p = rd1Params(policy);
  it("reads params from the policy file", () => {
    expect(p).toEqual({ minExcessMeters: 500, minExcessRatio: 0.1 });
  });
  it("4000 m reference -> threshold 500; 500 not material, 501 material", () => {
    expect(rd1ThresholdMeters(4000, p)).toBe(500);
    expect(rd1Exceeds(500, 500)).toBe(false);
    expect(rd1Exceeds(501, 500)).toBe(true);
  });
  it("8000 m reference -> threshold 800", () => {
    expect(rd1ThresholdMeters(8000, p)).toBe(800);
  });
  it("responds to a changed policy param", () => {
    expect(rd1ThresholdMeters(4000, { minExcessMeters: 300, minExcessRatio: 0.1 })).toBe(400);
  });
});

describe("stop detection", () => {
  const t0 = 1_800_000_000;
  const ping = (s: number, northM: number): Ping => ({ ts: toIsoUtc(t0 + s), lat: 1 + latDegForMeters(northM), lng: 103 });

  it("detects a 180 s dwell", () => {
    const pings = [ping(0, 0), ping(15, 170), ...Array.from({ length: 13 }, (_, i) => ping(30 + i * 15, 340)), ping(225, 510)];
    const stops = detectStops(pings);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.durationSec).toBe(180);
  });
  it("produces no stops for moving pings", () => {
    const pings = Array.from({ length: 40 }, (_, i) => ping(i * 15, i * 167));
    expect(detectStops(pings)).toEqual([]);
  });
  it("ignores dwells shorter than 120 s", () => {
    const pings = [ping(0, 0), ping(15, 200), ping(30, 200), ping(134, 200), ping(150, 400)];
    expect(detectStops(pings)).toEqual([]);
  });
  it("excludes stops within 150 m of the pickup or dropoff", () => {
    const pings = [ping(0, 0), ping(60, 0), ping(200, 0), ping(215, 300)];
    expect(detectStops(pings, [[1, 103]])).toEqual([]);
    expect(detectStops(pings)).toHaveLength(1);
  });
});
