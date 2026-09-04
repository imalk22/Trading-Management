import { describe, it, expect } from "vitest";
import { CURATED_SYMBOLS, DEFAULT_SYMBOL } from "./symbols";

describe("CURATED_SYMBOLS", () => {
  it("has 10 curated pairs, all quoted in USDT", () => {
    expect(CURATED_SYMBOLS).toHaveLength(10);
    expect(CURATED_SYMBOLS.every((s) => s.symbol.endsWith("USDT"))).toBe(true);
  });

  it("defaults to BTCUSDT", () => {
    expect(DEFAULT_SYMBOL).toBe("BTCUSDT");
  });

  it("labels PAXGUSDT as Gold with no matching futures contract", () => {
    const gold = CURATED_SYMBOLS.find((s) => s.symbol === "PAXGUSDT");
    expect(gold?.name).toBe("Gold");
    expect(gold?.futuresSymbol).toBeNull();
  });
});
