import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGlobalStats } from "./coingecko";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGlobalStats", () => {
  it("calls the internal global-stats route and returns its JSON", async () => {
    const payload = { totalMarketCapUsd: 3_120_000_000_000, totalVolumeUsd: 142_800_000_000, btcDominance: 54.2 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGlobalStats();

    expect(fetchMock).toHaveBeenCalledWith("/api/global-stats");
    expect(result).toEqual(payload);
  });
});
