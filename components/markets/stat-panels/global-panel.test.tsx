import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as coingecko from "@/lib/external/coingecko";
import * as rest from "@/lib/binance/rest";
import { GlobalPanel } from "./global-panel";

describe("GlobalPanel", () => {
  it("shows market cap, 24h volume, BTC dominance, and the selected symbol's open interest", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(coingecko, "fetchGlobalStats").mockResolvedValue({
      totalMarketCapUsd: 3_120_000_000_000,
      totalVolumeUsd: 142_800_000_000,
      btcDominance: 54.2,
    });
    vi.spyOn(rest, "fetchOpenInterest").mockResolvedValue({ symbol: "BTCUSDT", openInterest: 48600.12 });

    renderWithQueryClient(<GlobalPanel />);

    await waitFor(() => expect(screen.getByText("$3.12T")).toBeInTheDocument());
    expect(screen.getByText("$142.8B")).toBeInTheDocument();
    expect(screen.getByText("+54.20%")).toBeInTheDocument();
    expect(screen.getByText("48,600.12")).toBeInTheDocument();
  });

  it("shows placeholders instead of an infinite skeleton when fetches fail with no cached data", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(coingecko, "fetchGlobalStats").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchOpenInterest").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<GlobalPanel />);

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(4));
  });
});
