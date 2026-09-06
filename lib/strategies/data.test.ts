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
});
