import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";

vi.mock("@/lib/binance/rest", () => ({
  fetchTicker24hr: vi.fn(),
}));

import { fetchTicker24hr } from "@/lib/binance/rest";
import { TradeSummaryPanel } from "./trade-summary-panel";

describe("TradeSummaryPanel", () => {
  it("prompts for input when entry/TP/SL are incomplete", () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={null}
        takeProfitPrice={110}
        stopLossPrice={95}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText(/enter an entry price/i)).toBeInTheDocument();
  });

  it("shows a validation message for a contradictory trade setup", () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={100}
        takeProfitPrice={110}
        stopLossPrice={105}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText(/isn't a valid trade setup/i)).toBeInTheDocument();
  });

  it("computes and displays direction, risk:reward, and position size for a valid long trade", async () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={100}
        takeProfitPrice={110}
        stopLossPrice={95}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText("long")).toBeInTheDocument();
    expect(screen.getByText("1:2.00")).toBeInTheDocument();
    expect(await screen.findByText(/20\.0000 units/)).toBeInTheDocument();
  });
});
