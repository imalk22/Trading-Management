import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import * as rest from "@/lib/binance/rest";

vi.mock("./candlestick-chart", () => ({
  CandlestickChart: ({ symbol, interval }: { symbol: string; interval: string }) => (
    <div data-testid="chart-stub">
      {symbol}-{interval}
    </div>
  ),
}));

import { ChartPanel } from "./chart-panel";

describe("ChartPanel", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 81687.73,
        lowPrice: 78798.97,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
    vi.spyOn(rest, "fetchFundingRate").mockResolvedValue({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260.1,
      indexPrice: 80243.35,
    });
  });

  it("shows the selected symbol's price header and funding rate", async () => {
    renderWithQueryClient(<ChartPanel />);
    await waitFor(() => expect(screen.getByText("80,243.35")).toBeInTheDocument());
    expect(screen.getByText(/24h High 81,687.73/)).toBeInTheDocument();
    expect(screen.getByText(/24h Low 78,798.97/)).toBeInTheDocument();
    expect(screen.getByText(/Funding \+0.01%/)).toBeInTheDocument();
  });

  it("defaults to the 15m timeframe and switches the chart when a tab is clicked", async () => {
    renderWithQueryClient(<ChartPanel />);
    await waitFor(() => expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-15m"));
    fireEvent.click(screen.getByRole("tab", { name: "1h" }));
    expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-1h");
  });
});
