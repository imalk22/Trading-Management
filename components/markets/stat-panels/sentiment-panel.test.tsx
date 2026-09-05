import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as rest from "@/lib/binance/rest";
import { SentimentPanel } from "./sentiment-panel";

describe("SentimentPanel", () => {
  it("shows buy/sell percentages derived from the long/short account ratio", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockResolvedValue({ longAccount: 0.64, shortAccount: 0.36 });

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText("64% Buy")).toBeInTheDocument());
    expect(screen.getByText("36% Sell")).toBeInTheDocument();
  });

  it("shows an unavailable message for symbols with no futures contract", async () => {
    useSymbolStore.setState({ selectedSymbol: "PAXGUSDT" });
    const fetchMock = vi.spyOn(rest, "fetchLongShortRatio");

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText(/not available for paxgusdt/i)).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a distinct message when the fetch fails for a futures-backed symbol, not the no-futures message", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText("Sentiment data unavailable")).toBeInTheDocument());
    expect(screen.queryByText(/not available for btcusdt/i)).not.toBeInTheDocument();
  });
});
