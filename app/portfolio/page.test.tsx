import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Trade } from "@/lib/portfolio/types";

const openTrade: Trade = {
  id: "1",
  symbol: "BTCUSDT",
  direction: "long",
  entryPrice: 100,
  stopLossPrice: 95,
  takeProfitPrice: 110,
  units: 1,
  openedAt: 1700000000000,
  exitPrice: null,
  closedAt: null,
  notes: "",
};

const closedTrade: Trade = { ...openTrade, id: "2", symbol: "ETHUSDT", exitPrice: 110, closedAt: 1700001000000 };

const mockDeleteTrade = vi.fn();
const mockUseTradeStore = vi.fn();

vi.mock("@/lib/portfolio/trade-store", () => ({
  useTradeStore: (selector: (s: unknown) => unknown) => selector(mockUseTradeStore()),
  hydrateTradesFromStorage: vi.fn(),
}));

vi.mock("@/lib/analyzer/account-settings-store", () => ({
  useAccountSettingsStore: (selector: (s: unknown) => unknown) => selector({ accountBalance: 10000, riskPercent: 1 }),
}));

vi.mock("@/lib/query/use-open-trade-prices", () => ({
  useOpenTradePrices: () => ({ data: { BTCUSDT: 105 }, isLoading: false, isStale: false }),
}));

import PortfolioPage from "./page";

describe("PortfolioPage", () => {
  beforeEach(() => {
    mockDeleteTrade.mockClear();
    mockUseTradeStore.mockReturnValue({
      trades: [openTrade, closedTrade],
      deleteTrade: mockDeleteTrade,
    });
  });

  it("renders the stats summary and only closed trades in the history list", () => {
    render(<PortfolioPage />);
    expect(screen.getByText("Portfolio Stats")).toBeInTheDocument();
    expect(screen.getAllByText("ETHUSDT")).toHaveLength(1);
    expect(screen.queryByText("BTCUSDT")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no closed trades", () => {
    mockUseTradeStore.mockReturnValue({ trades: [openTrade], deleteTrade: mockDeleteTrade });
    render(<PortfolioPage />);
    expect(screen.getByText(/no closed trades yet/i)).toBeInTheDocument();
  });
});
