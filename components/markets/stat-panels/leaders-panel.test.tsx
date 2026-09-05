import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import * as rest from "@/lib/binance/rest";
import { LeadersPanel } from "./leaders-panel";

describe("LeadersPanel", () => {
  it("shows the top 3 gainers sorted by 24h percent change", async () => {
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "XAUUSDT",
        lastPrice: 0,
        priceChangePercent: 0.44,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "BTCUSDT",
        lastPrice: 0,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "DOTUSDT",
        lastPrice: 0,
        priceChangePercent: -1.2,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "ETHUSDT",
        lastPrice: 0,
        priceChangePercent: 0.9,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);

    renderWithQueryClient(<LeadersPanel />);

    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    expect(screen.getByText("XAU")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.queryByText("DOT")).not.toBeInTheDocument();
  });

  it("shows a placeholder instead of an empty card when there is no ticker data", async () => {
    vi.spyOn(rest, "fetchTicker24hr").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<LeadersPanel />);

    await waitFor(() => expect(screen.getByText("No data available")).toBeInTheDocument());
  });
});
