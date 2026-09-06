import { describe, it, expect } from "vitest";
import { computeTrade } from "./trade";
import type { GeneratedCandle } from "./rng";

describe("computeTrade", () => {
  it("sets a long trade's stop below the recent swing low and target at 2x that risk, exiting at take-profit if hit first", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 98, close: 100 },
      { time: 1, open: 100, high: 102, low: 99, close: 101 },
      { time: 2, open: 101, high: 103, low: 100, close: 102 }, // entry
      { time: 3, open: 102, high: 104, low: 101, close: 103 },
      { time: 4, open: 103, high: 200, low: 102, close: 110 }, // high spikes through take-profit
    ];
    // Swing low over indices 0-2 is 98. Entry (close at index 2) is 102. Risk = 102-98 = 4.
    // Stop-loss = 98. Take-profit = 102 + 4*2 = 110.
    const result = computeTrade(candles, 2, "long");
    expect(result.entryPrice).toBe(102);
    expect(result.stopLossPrice).toBe(98);
    expect(result.takeProfitPrice).toBe(110);
    expect(result.exitIndex).toBe(4);
    expect(result.exitReason).toBe("take-profit");
  });

  it("exits at stop-loss when price breaches it before reaching take-profit", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 98, close: 100 },
      { time: 1, open: 100, high: 102, low: 99, close: 101 },
      { time: 2, open: 101, high: 103, low: 100, close: 102 }, // entry: stop-loss=98, take-profit=110
      { time: 3, open: 102, high: 103, low: 97, close: 98 }, // low breaches 98
      { time: 4, open: 98, high: 200, low: 97, close: 110 },
    ];
    const result = computeTrade(candles, 2, "long");
    expect(result.exitIndex).toBe(3);
    expect(result.exitReason).toBe("stop-loss");
  });

  it("mirrors stop/target above the recent swing high for a short trade", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 104, low: 99, close: 100 },
      { time: 1, open: 100, high: 103, low: 98, close: 99 },
      { time: 2, open: 99, high: 101, low: 97, close: 98 }, // entry
      { time: 3, open: 98, high: 99, low: 96, close: 97 },
      { time: 4, open: 97, high: 98, low: 80, close: 82 }, // low drops through take-profit
    ];
    // Swing high over indices 0-2 is 104. Entry (close at index 2) is 98. Risk = 104-98 = 6.
    // Stop-loss = 104. Take-profit = 98 - 6*2 = 86.
    const result = computeTrade(candles, 2, "short");
    expect(result.entryPrice).toBe(98);
    expect(result.stopLossPrice).toBe(104);
    expect(result.takeProfitPrice).toBe(86);
    expect(result.exitIndex).toBe(4);
    expect(result.exitReason).toBe("take-profit");
  });

  it("reports end-of-data when neither level is reached before the series ends", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 99, close: 100 },
      { time: 1, open: 100, high: 101, low: 99, close: 100 },
      { time: 2, open: 100, high: 101, low: 99, close: 100 }, // entry: stop-loss=99, take-profit=102
      { time: 3, open: 100, high: 100.5, low: 99.5, close: 100 }, // stays inside both levels
    ];
    const result = computeTrade(candles, 2, "long");
    expect(result.exitIndex).toBe(3);
    expect(result.exitReason).toBe("end-of-data");
  });
});
