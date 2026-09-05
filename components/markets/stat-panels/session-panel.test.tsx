import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as rest from "@/lib/binance/rest";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceDepth: () => ({
    bids: [{ price: 80230, quantity: 1 }],
    asks: [{ price: 80236.42, quantity: 1 }],
  }),
}));

import { SessionPanel } from "./session-panel";

describe("SessionPanel", () => {
  it("shows long/short, OI change, basis, and spread for a futures-backed symbol", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockResolvedValue({ longAccount: 0.58, shortAccount: 0.42 });
    vi.spyOn(rest, "fetchFundingRate").mockResolvedValue({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260,
      indexPrice: 80243.98,
    });
    vi.spyOn(rest, "fetchOpenInterestChange").mockResolvedValue({ changePercent: 1.24 });

    renderWithQueryClient(<SessionPanel />);

    await waitFor(() => expect(screen.getByText("58 / 42")).toBeInTheDocument());
    expect(screen.getByText("+1.24%")).toBeInTheDocument();
    expect(screen.getByText("+0.02%")).toBeInTheDocument();
    expect(screen.getByText(/0\.8 bps/)).toBeInTheDocument();
  });

  it("shows an unavailable message for symbols with no futures contract", () => {
    useSymbolStore.setState({ selectedSymbol: "PAXGUSDT" });
    renderWithQueryClient(<SessionPanel />);
    expect(screen.getByText(/not available for paxgusdt/i)).toBeInTheDocument();
  });

  it("shows placeholders instead of an infinite skeleton when fetches fail with no cached data", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchFundingRate").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchOpenInterestChange").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<SessionPanel />);

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(3));
  });
});
