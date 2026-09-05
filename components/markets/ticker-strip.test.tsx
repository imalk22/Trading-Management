import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { TickerStrip } from "./ticker-strip";
import * as rest from "@/lib/binance/rest";

describe("TickerStrip", () => {
  it("renders each returned symbol's price and change badge", async () => {
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
    ]);

    renderWithQueryClient(<TickerStrip />);

    await waitFor(() => expect(screen.getByText("BTCUSDT")).toBeInTheDocument());
    expect(screen.getByText("80,243.35")).toBeInTheDocument();
    expect(screen.getByText("+2.14%")).toBeInTheDocument();
  });
});
