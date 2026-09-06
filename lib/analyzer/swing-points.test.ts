import { describe, it, expect } from "vitest";
import { findSwingHighs, findSwingLows } from "./swing-points";

describe("findSwingHighs", () => {
  it("finds local maxima using the given lookback window on each side", () => {
    const highs = [1, 2, 5, 2, 1, 1, 2, 6, 2, 1];
    expect(findSwingHighs(highs, 2)).toEqual([
      { index: 2, price: 5 },
      { index: 7, price: 6 },
    ]);
  });

  it("returns an empty array when no candle is a local maximum", () => {
    const highs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(findSwingHighs(highs, 2)).toEqual([]);
  });
});

describe("findSwingLows", () => {
  it("finds local minima using the given lookback window on each side", () => {
    const lows = [5, 4, 1, 4, 5, 5, 4, 0, 4, 5];
    expect(findSwingLows(lows, 2)).toEqual([
      { index: 2, price: 1 },
      { index: 7, price: 0 },
    ]);
  });

  it("returns an empty array when no candle is a local minimum", () => {
    const lows = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expect(findSwingLows(lows, 2)).toEqual([]);
  });
});
