import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("GET /api/global-stats", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and maps CoinGecko global stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total_market_cap: { usd: 3_120_000_000_000 },
          total_volume: { usd: 142_800_000_000 },
          market_cap_percentage: { btc: 54.2 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      totalMarketCapUsd: 3_120_000_000_000,
      totalVolumeUsd: 142_800_000_000,
      btcDominance: 54.2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves cached data on a second call without re-fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total_market_cap: { usd: 1 },
          total_volume: { usd: 1 },
          market_cap_percentage: { btc: 1 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET();
    await GET();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
