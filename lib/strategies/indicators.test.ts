import { describe, it, expect } from "vitest";
import { sma, ema, rsi, rollingStdev } from "./indicators";

describe("sma", () => {
  it("computes a trailing simple moving average, undefined before the window fills", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([undefined, undefined, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("weights recent values more heavily than a simple average would", () => {
    // period=3, k=0.5. Seed at index2 = avg(10,10,10) = 10.
    // index3: 20*0.5 + 10*0.5 = 15 (an SMA here would give (10+10+20)/3 = 13.33 -- different, proving EMA weighting).
    // index4: 10*0.5 + 15*0.5 = 12.5
    // index5: 10*0.5 + 12.5*0.5 = 11.25
    // index6: 10*0.5 + 11.25*0.5 = 10.625
    const result = ema([10, 10, 10, 20, 10, 10, 10], 3);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(10);
    expect(result[3]).toBe(15);
    expect(result[4]).toBe(12.5);
    expect(result[5]).toBe(11.25);
    expect(result[6]).toBe(10.625);
  });
});

describe("rsi", () => {
  it("returns 50 when average gains and losses over the period are equal", () => {
    // Alternating +1/-1 changes: 7 gains of 1, 7 losses of 1 over the 14-period window.
    const values = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
    const result = rsi(values, 14);
    expect(result[14]).toBe(50);
  });

  it("returns undefined before the window fills", () => {
    const result = rsi([1, 2, 3], 14);
    expect(result.every((v) => v === undefined)).toBe(true);
  });
});

describe("rollingStdev", () => {
  it("computes the population standard deviation over a trailing window", () => {
    expect(rollingStdev([1, 3], 2)).toEqual([undefined, 1]);
  });

  it("returns undefined before the window fills", () => {
    expect(rollingStdev([1, 2], 3)).toEqual([undefined, undefined]);
  });
});
