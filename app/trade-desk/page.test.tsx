import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

const closedTrade: Trade = { ...openTrade, id: "2", exitPrice: 110, closedAt: 1700001000000 };

const mockAddTrade = vi.fn();
const mockCloseTrade = vi.fn();
const mockDeleteTrade = vi.fn();
const mockUseTradeStore = vi.fn();

vi.mock("@/lib/portfolio/trade-store", () => ({
  useTradeStore: (selector: (s: unknown) => unknown) => selector(mockUseTradeStore()),
  hydrateTradesFromStorage: vi.fn(),
}));

vi.mock("@/lib/query/use-open-trade-prices", () => ({
  useOpenTradePrices: () => ({ data: { BTCUSDT: 105 }, isLoading: false, isStale: false }),
}));

import TradeDeskPage from "./page";

describe("TradeDeskPage", () => {
  beforeEach(() => {
    mockAddTrade.mockClear();
    mockCloseTrade.mockClear();
    mockDeleteTrade.mockClear();
    mockUseTradeStore.mockReturnValue({
      trades: [openTrade, closedTrade],
      addTrade: mockAddTrade,
      closeTrade: mockCloseTrade,
      deleteTrade: mockDeleteTrade,
    });
  });

  it("renders only open trades in the Open Positions list", () => {
    render(<TradeDeskPage />);
    expect(screen.getAllByText("BTCUSDT")).toHaveLength(1);
  });

  it("shows the empty state when there are no open trades", () => {
    mockUseTradeStore.mockReturnValue({
      trades: [closedTrade],
      addTrade: mockAddTrade,
      closeTrade: mockCloseTrade,
      deleteTrade: mockDeleteTrade,
    });
    render(<TradeDeskPage />);
    expect(screen.getByText(/no trades logged yet/i)).toBeInTheDocument();
  });

  it("calls addTrade with a generated id and openedAt when the form is submitted", () => {
    render(<TradeDeskPage />);
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(mockAddTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        entryPrice: 200,
        units: 1,
        exitPrice: null,
        closedAt: null,
      })
    );
    const submittedTrade = mockAddTrade.mock.calls[0][0];
    expect(typeof submittedTrade.id).toBe("string");
    expect(typeof submittedTrade.openedAt).toBe("number");
  });

  it("calls closeTrade with the trade id, parsed exit price, and a timestamp when a trade is closed", () => {
    render(<TradeDeskPage />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByPlaceholderText("Exit price"), { target: { value: "108" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(mockCloseTrade).toHaveBeenCalledWith("1", 108, expect.any(Number));
  });
});
