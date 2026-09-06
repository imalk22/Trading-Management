import { describe, it, expect } from "vitest";
import { inferDirection, computeRiskReward, computePositionSize, computeMaxLossGain } from "./calculations";

describe("inferDirection", () => {
  it("infers long when take-profit is above entry and stop-loss is below entry", () => {
    expect(inferDirection(100, 110, 95)).toBe("long");
  });

  it("infers short when take-profit is below entry and stop-loss is above entry", () => {
    expect(inferDirection(100, 90, 105)).toBe("short");
  });

  it("is invalid when take-profit and stop-loss are on the same side of entry", () => {
    expect(inferDirection(100, 110, 105)).toBe("invalid");
  });

  it("is invalid when stop-loss equals entry price", () => {
    expect(inferDirection(100, 110, 100)).toBe("invalid");
  });

  it("is invalid when take-profit equals entry price", () => {
    expect(inferDirection(100, 100, 95)).toBe("invalid");
  });
});

describe("computeRiskReward", () => {
  it("computes the ratio for a long trade", () => {
    expect(computeRiskReward(100, 110, 95, "long")).toBeCloseTo(2, 5);
  });

  it("computes the ratio for a short trade", () => {
    expect(computeRiskReward(100, 90, 105, "short")).toBeCloseTo(2, 5);
  });
});

describe("computePositionSize", () => {
  it("sizes a position from account balance, risk percent, and the entry-to-stop distance", () => {
    const result = computePositionSize(10000, 1, 100, 95);
    expect(result.units).toBeCloseTo(20, 5);
    expect(result.notionalValue).toBeCloseTo(2000, 5);
  });

  it("returns Infinity units rather than NaN when entry equals stop-loss", () => {
    const result = computePositionSize(10000, 1, 100, 100);
    expect(result.units).toBe(Infinity);
    expect(Number.isNaN(result.units)).toBe(false);
  });
});

describe("computeMaxLossGain", () => {
  it("computes max loss/gain in dollars and percent of account for a long trade", () => {
    const { units } = computePositionSize(10000, 1, 100, 95);
    const result = computeMaxLossGain(units, 10000, 100, 110, 95, "long");
    expect(result.maxLossAmount).toBeCloseTo(100, 5);
    expect(result.maxLossPercent).toBeCloseTo(1, 5);
    expect(result.maxGainAmount).toBeCloseTo(200, 5);
    expect(result.maxGainPercent).toBeCloseTo(2, 5);
  });

  it("computes max loss/gain in dollars and percent of account for a short trade", () => {
    const { units } = computePositionSize(10000, 1, 100, 105);
    const result = computeMaxLossGain(units, 10000, 100, 90, 105, "short");
    expect(result.maxLossAmount).toBeCloseTo(100, 5);
    expect(result.maxLossPercent).toBeCloseTo(1, 5);
    expect(result.maxGainAmount).toBeCloseTo(200, 5);
    expect(result.maxGainPercent).toBeCloseTo(2, 5);
  });
});
