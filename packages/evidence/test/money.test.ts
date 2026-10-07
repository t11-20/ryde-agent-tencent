import { describe, expect, it } from "vitest";
import { divHalfUp, formatSgd } from "../src/calc/money.js";

describe("divHalfUp", () => {
  it("matches the handoff vectors", () => {
    expect(divHalfUp(1000 * 75 * 150, 100000)).toBe(113);
    expect(divHalfUp(2000 * 75 * 100, 100000)).toBe(150);
    expect(divHalfUp(75 * 100, 100000)).toBe(0);
  });
  it("rounds exact halves up", () => {
    expect(divHalfUp(5, 10)).toBe(1);
    expect(divHalfUp(4, 10)).toBe(0);
    expect(divHalfUp(1473 * 50, 100)).toBe(737);
  });
  it("throws on negative, fractional or zero arguments", () => {
    expect(() => divHalfUp(-1, 10)).toThrow(RangeError);
    expect(() => divHalfUp(1.5, 10)).toThrow(RangeError);
    expect(() => divHalfUp(10, 0)).toThrow(RangeError);
    expect(() => divHalfUp(10, -2)).toThrow(RangeError);
    expect(() => divHalfUp(10, 2.5)).toThrow(RangeError);
    expect(() => divHalfUp(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow(RangeError);
  });
});

describe("formatSgd", () => {
  it("formats integer cents", () => {
    expect(formatSgd(198)).toBe("S$1.98");
    expect(formatSgd(0)).toBe("S$0.00");
    expect(formatSgd(1910)).toBe("S$19.10");
    expect(formatSgd(-300)).toBe("-S$3.00");
    expect(formatSgd(5)).toBe("S$0.05");
  });
  it("rejects non-integers", () => {
    expect(() => formatSgd(1.5)).toThrow();
  });
});
