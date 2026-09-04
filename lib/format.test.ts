import { describe, it, expect } from "vitest";
import { formatPrice, formatPercent, formatCompact } from "./format";

describe("formatPrice", () => {
  it("formats prices >= 1 with 2 decimals and thousands separators", () => {
    expect(formatPrice(80243.35)).toBe("80,243.35");
  });

  it("formats prices between 0.01 and 1 with 4 decimals", () => {
    expect(formatPrice(0.09)).toBe("0.0900");
  });

  it("formats prices under 0.01 with 6 decimals", () => {
    expect(formatPrice(0.0000123)).toBe("0.000012");
  });
});

describe("formatPercent", () => {
  it("prefixes positive values with a plus sign", () => {
    expect(formatPercent(2.144)).toBe("+2.14%");
  });

  it("keeps the minus sign on negative values without a plus", () => {
    expect(formatPercent(-0.408)).toBe("-0.41%");
  });

  it("formats zero without a sign", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });
});

describe("formatCompact", () => {
  it("formats billions", () => {
    expect(formatCompact(4_820_000_000)).toBe("4.82B");
  });

  it("formats trillions", () => {
    expect(formatCompact(3_120_000_000_000)).toBe("3.12T");
  });
});
