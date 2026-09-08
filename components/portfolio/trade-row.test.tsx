import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeRow } from "./trade-row";
import type { Trade } from "@/lib/portfolio/types";

const openTrade: Trade = {
  id: "1",
  symbol: "BTCUSDT",
  direction: "long",
  entryPrice: 100,
  stopLossPrice: 95,
  takeProfitPrice: 110,
  units: 2,
  openedAt: 1700000000000,
  exitPrice: null,
  closedAt: null,
  notes: "",
};

const closedTrade: Trade = {
  ...openTrade,
  id: "2",
  exitPrice: 110,
  closedAt: 1700001000000,
};

describe("TradeRow", () => {
  it("shows live unrealized PnL for an open trade when a current price is provided", () => {
    render(<TradeRow trade={openTrade} currentPrice={110} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/20\.00/)).toBeInTheDocument();
  });

  it("shows a live-price-unavailable message for an open trade with no current price", () => {
    render(<TradeRow trade={openTrade} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/live price unavailable/i)).toBeInTheDocument();
  });

  it("shows realized PnL for a closed trade using its stored exit price, ignoring currentPrice", () => {
    render(<TradeRow trade={closedTrade} currentPrice={999} onDelete={vi.fn()} />);
    expect(screen.getByText(/20\.00/)).toBeInTheDocument();
  });

  it("does not show a Close action for a closed trade", () => {
    render(<TradeRow trade={closedTrade} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("reveals an exit-price input and calls onClose with the parsed value when confirmed", () => {
    const onClose = vi.fn();
    render(<TradeRow trade={openTrade} currentPrice={105} onClose={onClose} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByPlaceholderText("Exit price"), { target: { value: "108" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onClose).toHaveBeenCalledWith("1", 108);
  });

  it("confirms the close when Enter is pressed in the exit-price input", () => {
    const onClose = vi.fn();
    render(<TradeRow trade={openTrade} currentPrice={105} onClose={onClose} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByLabelText("Exit price"), { target: { value: "108" } });
    fireEvent.keyDown(screen.getByLabelText("Exit price"), { key: "Enter" });

    expect(onClose).toHaveBeenCalledWith("1", 108);
  });

  it("calls onDelete with the trade id when Delete is clicked", () => {
    const onDelete = vi.fn();
    render(<TradeRow trade={openTrade} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
