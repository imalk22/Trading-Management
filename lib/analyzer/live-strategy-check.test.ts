import { describe, it, expect } from "vitest";
import { generateWalk } from "@/lib/strategies/rng";
import { STRATEGIES } from "@/lib/strategies/data";
import { computeStrategyAlignments } from "./live-strategy-check";

describe("computeStrategyAlignments", () => {
  it("returns one result per strategy in STRATEGIES, in the same order", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "long");
    expect(results.map((r) => r.strategyId)).toEqual(STRATEGIES.map((s) => s.id));
  });

  it("marks the short-only Head & Shoulders strategy as not-applicable for a long trade direction", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "long");
    const hs = results.find((r) => r.strategyId === "head-and-shoulders-reversal")!;
    expect(hs.status).toBe("not-applicable");
  });

  it("marks the five long-only strategies as not-applicable for a short trade direction", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "short");
    const longOnlyIds = [
      "moving-average-crossover",
      "rsi-mean-reversion",
      "support-resistance-breakout",
      "bollinger-band-squeeze",
      "macd-momentum-cross",
    ];
    for (const id of longOnlyIds) {
      expect(results.find((r) => r.strategyId === id)!.status).toBe("not-applicable");
    }
  });

  it("evaluates the moving average crossover as aligned when a real crossover just happened at the latest candle", () => {
    const candles = generateWalk({
      seed: 1,
      count: 60,
      startPrice: 100,
      driftAt: (i) => (i < 20 ? -0.05 : 0.35),
      volatilityAt: () => 1,
    }).slice(0, 23);
    const results = computeStrategyAlignments(candles, "long");
    const ma = results.find((r) => r.strategyId === "moving-average-crossover")!;
    expect(ma.status).toBe("aligned");
  });

  it("evaluates the moving average crossover as not-yet before any crossover has happened", () => {
    const candles = generateWalk({
      seed: 1,
      count: 60,
      startPrice: 100,
      driftAt: (i) => (i < 20 ? -0.05 : 0.35),
      volatilityAt: () => 1,
    }).slice(0, 20);
    const results = computeStrategyAlignments(candles, "long");
    const ma = results.find((r) => r.strategyId === "moving-average-crossover")!;
    expect(ma.status).toBe("not-yet");
  });
});
