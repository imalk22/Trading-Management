import { describe, it, expect } from "vitest";
import { generateWalk } from "@/lib/strategies/rng";
import { evaluateHeadAndShouldersLive } from "./head-and-shoulders-live";

describe("evaluateHeadAndShouldersLive", () => {
  it("detects alignment once a real three-peak pattern has broken below its neckline", () => {
    const phaseLength = 10;
    const driftAt = (i: number) => {
      const phase = Math.floor(i / phaseLength);
      switch (phase) {
        case 0:
          return 0.5;
        case 1:
          return -0.3;
        case 2:
          return 0.6;
        case 3:
          return -0.6;
        case 4:
          return 0.3;
        default:
          return -0.8;
      }
    };
    // Same seed/drift as lib/strategies/data.ts's buildHeadAndShoulders, which already
    // proved this produces a valid pattern with a confirmed breakdown by candle 63.
    const candles = generateWalk({ seed: 21, count: 70, startPrice: 100, driftAt, volatilityAt: () => 0.6 });

    const result = evaluateHeadAndShouldersLive(candles.slice(0, 63).map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(true);
  });

  it("does not report alignment when price is only trending steadily upward (no head-and-shoulders shape)", () => {
    const candles = generateWalk({
      seed: 99,
      count: 60,
      startPrice: 100,
      driftAt: () => 0.3,
      volatilityAt: () => 0.5,
    });

    const result = evaluateHeadAndShouldersLive(candles.map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(false);
  });

  it("does not report alignment when fewer than three swing highs exist yet", () => {
    const candles = generateWalk({ seed: 1, count: 10, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 0.3 });
    const result = evaluateHeadAndShouldersLive(candles.map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(false);
  });
});
