import { create } from "zustand";
import type { Trade } from "./types";

export const TRADE_STORAGE_KEY = "trade-desk-trades";

interface TradeState {
  trades: Trade[];
  addTrade: (trade: Trade) => void;
  closeTrade: (id: string, exitPrice: number, closedAt: number) => void;
  deleteTrade: (id: string) => void;
}

function persistTrades(trades: Trade[]): void {
  try {
    window.localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(trades));
  } catch (err) {
    console.error("Failed to persist trades to localStorage", err);
  }
}

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  addTrade: (trade) => {
    const next = [...get().trades, trade];
    set({ trades: next });
    persistTrades(next);
  },
  closeTrade: (id, exitPrice, closedAt) => {
    const next = get().trades.map((t) => (t.id === id ? { ...t, exitPrice, closedAt } : t));
    set({ trades: next });
    persistTrades(next);
  },
  deleteTrade: (id) => {
    const next = get().trades.filter((t) => t.id !== id);
    set({ trades: next });
    persistTrades(next);
  },
}));

function isValidTrade(value: unknown): value is Trade {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.symbol === "string" &&
    (t.direction === "long" || t.direction === "short") &&
    typeof t.entryPrice === "number" &&
    (t.stopLossPrice === null || typeof t.stopLossPrice === "number") &&
    (t.takeProfitPrice === null || typeof t.takeProfitPrice === "number") &&
    typeof t.units === "number" &&
    typeof t.openedAt === "number" &&
    (t.exitPrice === null || typeof t.exitPrice === "number") &&
    (t.closedAt === null || typeof t.closedAt === "number") &&
    typeof t.notes === "string"
  );
}

export function loadPersistedTrades(): Trade[] | null {
  try {
    const raw = window.localStorage.getItem(TRADE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValidTrade);
  } catch {
    return null;
  }
}

export function hydrateTradesFromStorage(): void {
  const loaded = loadPersistedTrades();
  if (loaded) {
    useTradeStore.setState({ trades: loaded });
  }
}
