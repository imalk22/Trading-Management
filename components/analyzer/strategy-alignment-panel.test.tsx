import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";

vi.mock("@/lib/binance/rest", () => ({
  fetchKlines: vi.fn(),
}));

import { fetchKlines } from "@/lib/binance/rest";
import { StrategyAlignmentPanel } from "./strategy-alignment-panel";

function candle(i: number, close: number) {
  return { openTime: i, open: close, high: close + 1, low: close - 1, close, volume: 100, closeTime: i };
}

describe("StrategyAlignmentPanel", () => {
  it("prompts for a valid trade setup when direction is invalid", () => {
    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="invalid" />);
    expect(screen.getByText(/enter a valid trade setup/i)).toBeInTheDocument();
    expect(fetchKlines).not.toHaveBeenCalled();
  });

  it("renders one row per strategy once live data resolves", async () => {
    const candles = Array.from({ length: 100 }, (_, i) => candle(i, 100 + i * 0.1));
    vi.mocked(fetchKlines).mockResolvedValue(candles);

    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="long" />);

    expect(await screen.findByText("Moving Average Crossover")).toBeInTheDocument();
    expect(screen.getByText("RSI Mean Reversion")).toBeInTheDocument();
    expect(screen.getByText("Support/Resistance Breakout")).toBeInTheDocument();
    expect(screen.getByText("Bollinger Band Squeeze")).toBeInTheDocument();
    expect(screen.getByText("MACD Momentum Cross")).toBeInTheDocument();
    expect(screen.getByText("Head & Shoulders Reversal")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("shows a data-unavailable message when the live fetch fails", async () => {
    vi.mocked(fetchKlines).mockRejectedValue(new Error("network error"));
    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="long" />);
    expect(await screen.findByText(/live strategy data unavailable/i)).toBeInTheDocument();
  });
});
