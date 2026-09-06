import { describe, it, expect } from "vitest";
import {
  detectMovingAverageCrossover,
  detectRsiMeanReversion,
  detectSupportResistanceBreakout,
  detectBollingerSqueeze,
  detectMacdMomentumCross,
  detectHeadAndShoulders,
} from "./detectors";

describe("detectMovingAverageCrossover", () => {
  it("is aligned when the fast average just crossed above the slow average", () => {
    const result = detectMovingAverageCrossover(99, 100, 101, 100.5);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when the fast average was already above the slow average", () => {
    const result = detectMovingAverageCrossover(101, 100, 102, 100.2);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when either average isn't available yet", () => {
    const result = detectMovingAverageCrossover(undefined, 100, 101, 100.5);
    expect(result.aligned).toBe(false);
  });
});

describe("detectRsiMeanReversion", () => {
  it("is aligned when RSI has recovered above 30 after a prior oversold dip", () => {
    const result = detectRsiMeanReversion(32, true);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when RSI is above 30 but never dipped oversold first", () => {
    const result = detectRsiMeanReversion(32, false);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when RSI is still below 30", () => {
    const result = detectRsiMeanReversion(25, true);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when RSI isn't available yet", () => {
    const result = detectRsiMeanReversion(undefined, true);
    expect(result.aligned).toBe(false);
  });
});

describe("detectSupportResistanceBreakout", () => {
  it("is aligned when price closes above resistance", () => {
    expect(detectSupportResistanceBreakout(105, 100).aligned).toBe(true);
  });

  it("is not aligned when price closes below resistance", () => {
    expect(detectSupportResistanceBreakout(98, 100).aligned).toBe(false);
  });
});

describe("detectBollingerSqueeze", () => {
  it("is aligned when price closes above the upper band", () => {
    expect(detectBollingerSqueeze(110, 100, 4).aligned).toBe(true);
  });

  it("is not aligned when price closes inside the upper band", () => {
    expect(detectBollingerSqueeze(105, 100, 4).aligned).toBe(false);
  });

  it("is not aligned when the bands aren't available yet", () => {
    expect(detectBollingerSqueeze(110, undefined, undefined).aligned).toBe(false);
  });
});

describe("detectMacdMomentumCross", () => {
  it("is aligned when MACD just crossed above its signal line", () => {
    const result = detectMacdMomentumCross(-0.5, -0.2, 0.1, 0.05);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when MACD was already above its signal line", () => {
    const result = detectMacdMomentumCross(0.3, 0.1, 0.4, 0.15);
    expect(result.aligned).toBe(false);
  });
});

describe("detectHeadAndShoulders", () => {
  it("is aligned when price closes below the neckline", () => {
    expect(detectHeadAndShoulders(95, 100).aligned).toBe(true);
  });

  it("is not aligned when price closes above the neckline", () => {
    expect(detectHeadAndShoulders(102, 100).aligned).toBe(false);
  });
});
