import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  it("shows seconds for very recent timestamps", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30_000, now)).toBe("30s ago");
  });

  it("shows minutes once past 60 seconds", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("shows hours once past 60 minutes", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("shows days once past 24 hours", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
  });
});
