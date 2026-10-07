import { describe, expect, it } from "vitest";
import { formatConfidence } from "../src/components/JudgePanel";
import { apiBase, apiMode } from "../src/config";

describe("config", () => {
  it("defaults to live mode", () => {
    expect(apiMode({})).toBe("live");
    expect(apiMode({ MODE: "development" })).toBe("live");
    expect(apiMode({ VITE_API_MODE: "anything" })).toBe("live");
  });
  it("enables DEV MOCK only when asked", () => {
    expect(apiMode({ VITE_API_MODE: "mock" })).toBe("mock");
    expect(apiMode({ MODE: "mock" })).toBe("mock");
    expect(apiMode({ MODE: "mock", VITE_API_MODE: "live" })).toBe("live");
  });
  it("normalises the API base", () => {
    expect(apiBase({})).toBe("");
    expect(apiBase({ VITE_API_BASE: "http://x:3001/" })).toBe("http://x:3001");
  });
});

describe("formatConfidence", () => {
  it("shows a 0–1 confidence as a percentage and flags anything else", () => {
    expect(formatConfidence(0.86)).toBe("86%");
    expect(formatConfidence(1)).toBe("100%");
    expect(formatConfidence(86)).toBe("86 (outside the expected 0–1 scale)");
  });
});
