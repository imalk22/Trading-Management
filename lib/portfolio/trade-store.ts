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
  } catch {
    // localStorage may be unavailable (private browsing, disabled) - trades just won't persist
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

export function loadPersistedTrades(): Trade[] | null {
  try {
    const raw = window.localStorage.getItem(TRADE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return null;
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
