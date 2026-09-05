import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceTrades: () => [
    { id: 2, price: 80243.35, quantity: 0.9424, time: 1735689600000, isBuyerMaker: false },
    { id: 1, price: 80230.03, quantity: 0.3247, time: 1735689590000, isBuyerMaker: true },
  ],
}));

import { RecentTradesPanel } from "./recent-trades-panel";

describe("RecentTradesPanel", () => {
  it("renders trade rows colored by taker side", () => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    render(<RecentTradesPanel />);
    expect(screen.getByText("80,243.35")).toHaveClass("text-up");
    expect(screen.getByText("80,230.03")).toHaveClass("text-down");
    expect(screen.getByText("0.9424")).toBeInTheDocument();
  });
});
