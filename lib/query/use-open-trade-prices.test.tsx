import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useOpenTradePrices } from "./use-open-trade-prices";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useOpenTradePrices", () => {
  it("fetches current prices for the given symbols and returns a symbol-to-price map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                symbol: "BTCUSDT",
                lastPrice: "60000.00",
                priceChangePercent: "1.5",
                highPrice: "61000",
                lowPrice: "59000",
                volume: "100",
                quoteVolume: "6000000",
              },
              {
                symbol: "ETHUSDT",
                lastPrice: "3000.00",
                priceChangePercent: "2.0",
                highPrice: "3100",
                lowPrice: "2900",
                volume: "500",
                quoteVolume: "1500000",
              },
            ]),
        } as Response)
      )
    );

    const { result } = renderHook(() => useOpenTradePrices(["BTCUSDT", "ETHUSDT"]), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ BTCUSDT: 60000, ETHUSDT: 3000 }));

    vi.unstubAllGlobals();
  });

  it("returns an empty object without fetching when given no symbols", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOpenTradePrices([]), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({}));
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
