import { describe, expect, it } from "vitest";
import { distanceMeters, haversineRaw, pathLengthMeters, round1 } from "../src/calc/geo.js";

describe("geo", () => {
  it("one degree of latitude at the equator is 111,195 m ± 1", () => {
    expect(Math.abs(haversineRaw([0, 0], [1, 0]) - 111195)).toBeLessThanOrEqual(1);
    expect(distanceMeters([0, 0], [1, 0])).toBe(111195);
  });
  it("rounds distances and path lengths to whole metres", () => {
    expect(Number.isInteger(distanceMeters([1.35, 103.8], [1.36, 103.81]))).toBe(true);
    expect(pathLengthMeters([[0, 0], [0.5, 0], [1, 0]])).toBe(111195);
    expect(pathLengthMeters([[0, 0]])).toBe(0);
  });
  it("round1 rounds to one decimal place", () => {
    expect(round1(33.249)).toBe(33.2);
    expect(round1(33.25)).toBe(33.3);
  });
});
