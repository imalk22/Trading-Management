import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchTicker24hr,
  fetchKlines,
  fetchFundingRate,
  fetchLongShortRatio,
  fetchOpenInterest,
} from "./rest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTicker24hr", () => {
  it("requests the given symbols and normalizes numeric fields", async () => {
    const payload = [
      {
        symbol: "BTCUSDT",
        lastPrice: "80243.35000000",
        priceChangePercent: "2.140",
        highPrice: "81687.73000000",
        lowPrice: "78798.97000000",
        volume: "59234.12000000",
        quoteVolume: "4820000000.00000000",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTicker24hr(["BTCUSDT"]);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("BTCUSDT"));
    expect(result).toEqual([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 81687.73,
        lowPrice: 78798.97,
        volume: 59234.12,
        quoteVolume: 4_820_000_000,
      },
    ]);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchTicker24hr(["BTCUSDT"])).rejects.toThrow("429");
  });
});

describe("fetchKlines", () => {
  it("requests the symbol/interval and maps array rows to objects", async () => {
    const payload = [
      [1735689600000, "80000.00", "80500.00", "79800.00", "80243.35", "120.5", 1735690499999],
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKlines("BTCUSDT", "15m", 200);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("symbol=BTCUSDT&interval=15m&limit=200")
    );
    expect(result).toEqual([
      {
        openTime: 1735689600000,
        open: 80000,
        high: 80500,
        low: 79800,
        close: 80243.35,
        volume: 120.5,
        closeTime: 1735690499999,
      },
    ]);
  });
});

describe("fetchFundingRate", () => {
  it("returns the last funding rate and mark/index prices for a perpetual symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          symbol: "BTCUSDT",
          lastFundingRate: "0.00010000",
          markPrice: "80260.10000000",
          indexPrice: "80243.35000000",
        }),
      })
    );
    const result = await fetchFundingRate("BTCUSDT");
    expect(result).toEqual({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260.1,
      indexPrice: 80243.35,
    });
  });
});

describe("fetchLongShortRatio", () => {
  it("returns the latest long/short account ratio entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ longAccount: "0.64", shortAccount: "0.36" }],
      })
    );
    const result = await fetchLongShortRatio("BTCUSDT");
    expect(result).toEqual({ longAccount: 0.64, shortAccount: 0.36 });
  });
});

describe("fetchOpenInterest", () => {
  it("returns open interest for a symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ symbol: "BTCUSDT", openInterest: "48600.123" }),
      })
    );
    const result = await fetchOpenInterest("BTCUSDT");
    expect(result).toEqual({ symbol: "BTCUSDT", openInterest: 48600.123 });
  });
});
