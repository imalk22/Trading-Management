import { describe, it, expect, beforeEach } from "vitest";
import { useTradeStore, hydrateTradesFromStorage, loadPersistedTrades, TRADE_STORAGE_KEY } from "./trade-store";
import type { Trade } from "./types";

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "test-id",
    symbol: "BTCUSDT",
    direction: "long",
    entryPrice: 100,
    stopLossPrice: null,
    takeProfitPrice: null,
    units: 1,
    openedAt: 1700000000000,
    exitPrice: null,
    closedAt: null,
    notes: "",
    ...overrides,
  };
}

describe("trade store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useTradeStore.setState({ trades: [] });
  });

  it("initializes with an empty trades array", () => {
    expect(useTradeStore.getState().trades).toEqual([]);
  });

  it("addTrade appends a trade and persists to localStorage", () => {
    const trade = makeTrade();
    useTradeStore.getState().addTrade(trade);
    expect(useTradeStore.getState().trades).toEqual([trade]);
    const stored = JSON.parse(window.localStorage.getItem(TRADE_STORAGE_KEY)!);
    expect(stored).toEqual([trade]);
  });

  it("closeTrade sets exitPrice and closedAt on the matching trade only", () => {
    const trade1 = makeTrade({ id: "1" });
    const trade2 = makeTrade({ id: "2" });
    useTradeStore.getState().addTrade(trade1);
    useTradeStore.getState().addTrade(trade2);

    useTradeStore.getState().closeTrade("1", 110, 1700001000000);

    const trades = useTradeStore.getState().trades;
    expect(trades.find((t) => t.id === "1")).toEqual({ ...trade1, exitPrice: 110, closedAt: 1700001000000 });
    expect(trades.find((t) => t.id === "2")).toEqual(trade2);
  });

  it("deleteTrade removes the matching trade only", () => {
    const trade1 = makeTrade({ id: "1" });
    const trade2 = makeTrade({ id: "2" });
    useTradeStore.getState().addTrade(trade1);
    useTradeStore.getState().addTrade(trade2);

    useTradeStore.getState().deleteTrade("1");

    expect(useTradeStore.getState().trades).toEqual([trade2]);
  });

  it("hydrateTradesFromStorage loads previously persisted trades into the store", () => {
    const trade = makeTrade();
    window.localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify([trade]));
    hydrateTradesFromStorage();
    expect(useTradeStore.getState().trades).toEqual([trade]);
  });

  it("hydrateTradesFromStorage leaves the store unchanged when nothing is stored", () => {
    hydrateTradesFromStorage();
    expect(useTradeStore.getState().trades).toEqual([]);
  });

  it("loadPersistedTrades returns null for malformed JSON", () => {
    window.localStorage.setItem(TRADE_STORAGE_KEY, "not valid json");
    expect(loadPersistedTrades()).toBeNull();
  });

  it("loadPersistedTrades filters out malformed trade objects while keeping valid ones", () => {
    const validTrade = makeTrade({ id: "1" });
    const malformedTrade = { id: "2", symbol: "ETHUSDT" };
    window.localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify([validTrade, malformedTrade]));
    expect(loadPersistedTrades()).toEqual([validTrade]);
  });
});
