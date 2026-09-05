import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCuratedTickers } from "./use-curated-tickers";
import * as rest from "@/lib/binance/rest";

describe("useCuratedTickers", () => {
  it("fetches the curated symbol list once and shares it across callers", async () => {
    const fetchMock = vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useCuratedTickers(), { wrapper });
    const second = renderHook(() => useCuratedTickers(), { wrapper });

    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await waitFor(() => expect(second.result.current.data).toBeDefined());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
