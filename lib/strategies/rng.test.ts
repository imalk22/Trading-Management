import { describe, it, expect } from "vitest";
import { mulberry32, generateWalk } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
});

describe("generateWalk", () => {
  it("is deterministic for a given seed", () => {
    const optionsA = { seed: 7, count: 20, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 };
    const a = generateWalk(optionsA);
    const b = generateWalk({ ...optionsA });
    expect(a).toEqual(b);
  });

  it("produces the requested number of candles with sequential, evenly-spaced times", () => {
    const candles = generateWalk({ seed: 1, count: 10, startPrice: 100, driftAt: () => 0, volatilityAt: () => 1 });
    expect(candles).toHaveLength(10);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time - candles[i - 1].time).toBe(86400);
    }
  });

  it("keeps every candle's OHLC internally consistent (low <= open,close <= high)", () => {
    const candles = generateWalk({ seed: 3, count: 50, startPrice: 100, driftAt: () => 0.2, volatilityAt: () => 2 });
    for (const c of candles) {
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(c.high);
    }
  });

  it("keeps prices positive even under strong negative drift", () => {
    const candles = generateWalk({ seed: 9, count: 30, startPrice: 5, driftAt: () => -10, volatilityAt: () => 1 });
    for (const c of candles) {
      expect(c.open).toBeGreaterThan(0);
      expect(c.close).toBeGreaterThan(0);
      expect(c.low).toBeGreaterThan(0);
    }
  });

  it("chains each candle's open to the previous candle's close", () => {
    const candles = generateWalk({ seed: 5, count: 15, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].open).toBe(candles[i - 1].close);
    }
  });
});
