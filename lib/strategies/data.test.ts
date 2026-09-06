import { describe, it, expect } from "vitest";
import { STRATEGIES } from "./data";

describe("STRATEGIES", () => {
  it("has exactly 6 strategies with unique ids", () => {
    expect(STRATEGIES).toHaveLength(6);
    const ids = STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("covers all six categories exactly once", () => {
    const categories = STRATEGIES.map((s) => s.category).sort();
    expect(categories).toEqual(
      ["Breakout", "Chart Pattern", "Mean Reversion", "Momentum", "Trend Following", "Volatility Breakout"].sort()
    );
  });

  it("includes both long and short entry types", () => {
    const types = new Set(STRATEGIES.map((s) => s.entryType));
    expect(types.has("long")).toBe(true);
    expect(types.has("short")).toBe(true);
  });

  it("places the entry within the candle series and the exit strictly after it", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.entryIndex).toBeGreaterThan(0);
      expect(strategy.entryIndex).toBeLessThan(strategy.candles.length);
      expect(strategy.exitIndex).toBeGreaterThan(strategy.entryIndex);
      expect(strategy.exitIndex).toBeLessThan(strategy.candles.length);
    }
  });

  it("orders long-trade levels as stop-loss < entry < take-profit, and short-trade levels the other way", () => {
    for (const strategy of STRATEGIES) {
      if (strategy.entryType === "long") {
        expect(strategy.stopLossPrice).toBeLessThan(strategy.entryPrice);
        expect(strategy.entryPrice).toBeLessThan(strategy.takeProfitPrice);
      } else {
        expect(strategy.takeProfitPrice).toBeLessThan(strategy.entryPrice);
        expect(strategy.entryPrice).toBeLessThan(strategy.stopLossPrice);
      }
    }
  });

  it("resolves every strategy's trade before the data runs out (never falls through to end-of-data)", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.exitReason).not.toBe("end-of-data");
    }
  });

  it("gives every strategy a non-empty name and a substantive description", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.name.length).toBeGreaterThan(0);
      expect(strategy.description.length).toBeGreaterThan(20);
    }
  });

  it("finds a real entry signal for every strategy, never the hardcoded fallback index", () => {
    // Each build*() function throws if its scan loop falls through without finding
    // a real signal, so by the time STRATEGIES exists every entryIndex already came
    // from a genuine detection. This test additionally locks in that the detected
    // index isn't merely coincidental with the fallback default, guarding against a
    // future refactor that removes the throw and silently reintroduces the fallback.
    const fallbackByStrategyId: Record<string, number> = {
      "moving-average-crossover": 20,
      "rsi-mean-reversion": 26,
      "support-resistance-breakout": 40,
      "bollinger-band-squeeze": 36,
      "macd-momentum-cross": 40,
      "head-and-shoulders-reversal": 50,
    };

    expect(Object.keys(fallbackByStrategyId).sort()).toEqual(STRATEGIES.map((s) => s.id).sort());

    for (const strategy of STRATEGIES) {
      expect(strategy.entryIndex).not.toBe(fallbackByStrategyId[strategy.id]);
    }
  });

  it("shapes the head-and-shoulders pattern correctly: head above both shoulders, shoulders near-level", () => {
    const strategy = STRATEGIES.find((s) => s.id === "head-and-shoulders-reversal");
    expect(strategy).toBeDefined();
    if (!strategy) return;

    const phaseLength = 10;
    const leftShoulder = Math.max(...strategy.candles.slice(0, phaseLength).map((c) => c.high));
    const head = Math.max(...strategy.candles.slice(phaseLength * 2, phaseLength * 3).map((c) => c.high));
    const rightShoulder = Math.max(...strategy.candles.slice(phaseLength * 4, phaseLength * 5).map((c) => c.high));

    expect(head).toBeGreaterThan(leftShoulder);
    expect(head).toBeGreaterThan(rightShoulder);
    // Shoulders should read as roughly symmetric on a chart - allow a modest
    // absolute tolerance rather than an exact match, since the series is randomly
    // generated (deterministically, per seed).
    expect(Math.abs(leftShoulder - rightShoulder)).toBeLessThan(2);
  });
});
