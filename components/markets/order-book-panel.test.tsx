import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceDepth: () => ({
    bids: [{ price: 80230.03, quantity: 0.7251 }],
    asks: [{ price: 80243.35, quantity: 1.2327 }],
  }),
}));

import { OrderBookPanel } from "./order-book-panel";

describe("OrderBookPanel", () => {
  it("renders bid and ask rows with the right up/down coloring", () => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    render(<OrderBookPanel />);
    expect(screen.getByText("80,230.03")).toHaveClass("text-up");
    expect(screen.getByText("80,243.35")).toHaveClass("text-down");
    expect(screen.getByText("0.7251")).toBeInTheDocument();
    expect(screen.getByText("1.2327")).toBeInTheDocument();
  });
});
