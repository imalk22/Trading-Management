import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { MarketsList } from "./markets-list";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import * as rest from "@/lib/binance/rest";

describe("MarketsList", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "ETHUSDT",
        lastPrice: 2507.76,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
  });

  it("marks the default symbol's card as selected", async () => {
    renderWithQueryClient(<MarketsList />);
    await waitFor(() => expect(screen.getByText("80,243.35")).toBeInTheDocument());
    const cards = screen.getAllByRole("button");
    const btcCard = cards.find((c) => c.textContent?.includes("BTCUSDT"));
    expect(btcCard).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the selected symbol in the store when a different card is clicked", async () => {
    renderWithQueryClient(<MarketsList />);
    await waitFor(() => expect(screen.getByText("2,507.76")).toBeInTheDocument());
    const cards = screen.getAllByRole("button");
    const ethCard = cards.find((c) => c.textContent?.includes("ETHUSDT"))!;
    fireEvent.click(ethCard);
    expect(useSymbolStore.getState().selectedSymbol).toBe("ETHUSDT");
  });
});
