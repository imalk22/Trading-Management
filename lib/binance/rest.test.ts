import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTicker24hr, fetchKlines } from "./rest";

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
