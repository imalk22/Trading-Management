# Portfolio / Trade Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side trade journal split across `/trade-desk` (log new trades, track open positions with live unrealized PnL) and `/portfolio` (aggregate stats and closed-trade history) — the final phase of the platform.

**Architecture:** A Zustand + `localStorage` trade store (mirroring `lib/analyzer/account-settings-store.ts`'s exact SSR-safe pattern) holds every trade. Pure calculation functions compute per-trade PnL and portfolio-wide stats. A `useOpenTradePrices` hook fetches live prices (Phase 1's Binance REST helper) only for symbols with open positions. Both pages read the same store; only Trade Desk needs live prices for its open positions' unrealized PnL.

**Tech Stack:** Next.js 15, Zustand, TanStack Query (`useStaleAwareQuery`), `lib/binance/rest.ts`'s `fetchTicker24hr`, Vitest + Testing Library.

**Type-naming note (checked during planning):** this phase's `lib/portfolio/types.ts` defines its own `TradeDirection = "long" | "short"`, and `lib/analyzer/calculations.ts` (Phase 3) already exports a *different*, wider `TradeDirection = "long" | "short" | "invalid"`. No file in this plan imports both simultaneously — Trade Desk/Portfolio never call Phase 3's `inferDirection`/`computeRiskReward`/etc, they only reuse Phase 3's `useAccountSettingsStore` for the account balance — so there is no actual import collision. If a future phase ever needs both in one file, import one with an `as` alias; not needed here.

---

### Task 1: Trade types and PnL/stats calculations

The core logic every other task builds on — pure functions, no React, no network, the easiest and most important place to get exactly right via tests.

**Files:**
- Create: `lib/portfolio/types.ts`
- Create: `lib/portfolio/calculations.ts`, `lib/portfolio/calculations.test.ts`

- [ ] **Step 1: Write `lib/portfolio/types.ts`**

```ts
export type TradeDirection = "long" | "short";

export interface Trade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  units: number;
  openedAt: number;
  exitPrice: number | null;
  closedAt: number | null;
  notes: string;
}
```

- [ ] **Step 2: Write failing tests — `lib/portfolio/calculations.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeTradePnl, computePortfolioStats } from "./calculations";
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

describe("computeTradePnl", () => {
  it("computes a positive PnL for a profitable long trade", () => {
    const trade = makeTrade({ direction: "long", entryPrice: 100, units: 2 });
    const result = computeTradePnl(trade, 110);
    expect(result.pnlAmount).toBeCloseTo(20, 5);
    expect(result.pnlPercent).toBeCloseTo(10, 5);
  });

  it("computes a negative PnL for a losing long trade", () => {
    const trade = makeTrade({ direction: "long", entryPrice: 100, units: 2 });
    const result = computeTradePnl(trade, 90);
    expect(result.pnlAmount).toBeCloseTo(-20, 5);
    expect(result.pnlPercent).toBeCloseTo(-10, 5);
  });

  it("computes a positive PnL for a profitable short trade", () => {
    const trade = makeTrade({ direction: "short", entryPrice: 100, units: 2 });
    const result = computeTradePnl(trade, 90);
    expect(result.pnlAmount).toBeCloseTo(20, 5);
    expect(result.pnlPercent).toBeCloseTo(10, 5);
  });

  it("computes a negative PnL for a losing short trade", () => {
    const trade = makeTrade({ direction: "short", entryPrice: 100, units: 2 });
    const result = computeTradePnl(trade, 110);
    expect(result.pnlAmount).toBeCloseTo(-20, 5);
    expect(result.pnlPercent).toBeCloseTo(-10, 5);
  });
});

describe("computePortfolioStats", () => {
  it("returns zeroed stats and a null average R:R for no trades, not NaN", () => {
    const stats = computePortfolioStats([], 10000, {});
    expect(stats).toEqual({
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
      winRate: 0,
      averageRiskRewardAchieved: null,
      openRiskPercent: 0,
    });
  });

  it("computes realized PnL and win rate from closed trades", () => {
    const winningTrade = makeTrade({ id: "1", entryPrice: 100, exitPrice: 110, units: 1, closedAt: 1700001000000 });
    const losingTrade = makeTrade({ id: "2", entryPrice: 100, exitPrice: 95, units: 1, closedAt: 1700001000000 });
    const stats = computePortfolioStats([winningTrade, losingTrade], 10000, {});
    expect(stats.totalRealizedPnl).toBeCloseTo(5, 5);
    expect(stats.winRate).toBeCloseTo(50, 5);
  });

  it("excludes trades without a stop-loss from average risk:reward achieved", () => {
    const withStop = makeTrade({
      id: "1",
      entryPrice: 100,
      stopLossPrice: 95,
      exitPrice: 110,
      units: 1,
      closedAt: 1700001000000,
    });
    const withoutStop = makeTrade({
      id: "2",
      entryPrice: 100,
      stopLossPrice: null,
      exitPrice: 200,
      units: 1,
      closedAt: 1700001000000,
    });
    const stats = computePortfolioStats([withStop, withoutStop], 10000, {});
    expect(stats.averageRiskRewardAchieved).toBeCloseTo(2, 5);
  });

  it("returns a null average risk:reward when no closed trade has a stop-loss set", () => {
    const trade = makeTrade({ stopLossPrice: null, exitPrice: 110, closedAt: 1700001000000 });
    const stats = computePortfolioStats([trade], 10000, {});
    expect(stats.averageRiskRewardAchieved).toBeNull();
  });

  it("computes unrealized PnL for open trades using provided current prices", () => {
    const openTrade = makeTrade({ id: "1", symbol: "BTCUSDT", entryPrice: 100, units: 2 });
    const stats = computePortfolioStats([openTrade], 10000, { BTCUSDT: 110 });
    expect(stats.totalUnrealizedPnl).toBeCloseTo(20, 5);
  });

  it("treats an open trade with no current price available as contributing zero unrealized PnL", () => {
    const openTrade = makeTrade({ id: "1", symbol: "ETHUSDT", entryPrice: 100, units: 2 });
    const stats = computePortfolioStats([openTrade], 10000, {});
    expect(stats.totalUnrealizedPnl).toBe(0);
  });

  it("computes open risk as a percentage of account balance from open trades with a stop-loss, independent of current price data", () => {
    const openWithStop = makeTrade({ id: "1", symbol: "BTCUSDT", entryPrice: 100, stopLossPrice: 90, units: 2 });
    const openWithoutStop = makeTrade({ id: "2", symbol: "ETHUSDT", entryPrice: 100, stopLossPrice: null, units: 5 });
    const stats = computePortfolioStats([openWithStop, openWithoutStop], 10000, {});
    expect(stats.openRiskPercent).toBeCloseTo(0.2, 5);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/portfolio/calculations.test.ts`
Expected: FAIL — cannot find module `./calculations`

- [ ] **Step 4: Implement `lib/portfolio/calculations.ts`**

```ts
import type { Trade } from "./types";

export interface TradePnl {
  pnlAmount: number;
  pnlPercent: number;
}

export function computeTradePnl(trade: Trade, currentOrExitPrice: number): TradePnl {
  const directionMultiplier = trade.direction === "long" ? 1 : -1;
  const pnlAmount = (currentOrExitPrice - trade.entryPrice) * trade.units * directionMultiplier;
  const notionalValue = trade.entryPrice * trade.units;
  const pnlPercent = (pnlAmount / notionalValue) * 100;
  return { pnlAmount, pnlPercent };
}

export interface PortfolioStats {
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  winRate: number;
  averageRiskRewardAchieved: number | null;
  openRiskPercent: number;
}

export function computePortfolioStats(
  trades: Trade[],
  accountBalance: number,
  currentPrices: Record<string, number>
): PortfolioStats {
  const closedTrades = trades.filter((t) => t.closedAt !== null && t.exitPrice !== null);
  const openTrades = trades.filter((t) => t.closedAt === null);

  const totalRealizedPnl = closedTrades.reduce(
    (sum, t) => sum + computeTradePnl(t, t.exitPrice as number).pnlAmount,
    0
  );

  const totalUnrealizedPnl = openTrades.reduce((sum, t) => {
    const currentPrice = currentPrices[t.symbol];
    if (currentPrice === undefined) return sum;
    return sum + computeTradePnl(t, currentPrice).pnlAmount;
  }, 0);

  const winRate =
    closedTrades.length === 0
      ? 0
      : (closedTrades.filter((t) => computeTradePnl(t, t.exitPrice as number).pnlAmount > 0).length /
          closedTrades.length) *
        100;

  const tradesWithRisk = closedTrades.filter((t) => t.stopLossPrice !== null);
  const averageRiskRewardAchieved =
    tradesWithRisk.length === 0
      ? null
      : tradesWithRisk.reduce((sum, t) => {
          const riskPerUnit = Math.abs(t.entryPrice - (t.stopLossPrice as number));
          const pnlAmount = computeTradePnl(t, t.exitPrice as number).pnlAmount;
          return sum + pnlAmount / (t.units * riskPerUnit);
        }, 0) / tradesWithRisk.length;

  const openRiskAmount = openTrades
    .filter((t) => t.stopLossPrice !== null)
    .reduce((sum, t) => sum + t.units * Math.abs(t.entryPrice - (t.stopLossPrice as number)), 0);
  const openRiskPercent = accountBalance > 0 ? (openRiskAmount / accountBalance) * 100 : 0;

  return { totalRealizedPnl, totalUnrealizedPnl, winRate, averageRiskRewardAchieved, openRiskPercent };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/portfolio/calculations.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add lib/portfolio/types.ts lib/portfolio/calculations.ts lib/portfolio/calculations.test.ts
git commit -m "feat: add trade types and PnL/portfolio-stats calculations"
```

---

### Task 2: Trade store

A Zustand store persisting trades to `localStorage`, following `lib/analyzer/account-settings-store.ts`'s exact defaults-first-then-hydrate pattern (avoids the SSR/localStorage hydration-mismatch bug class that pattern was built to prevent).

**Files:**
- Create: `lib/portfolio/trade-store.ts`, `lib/portfolio/trade-store.test.ts`

- [ ] **Step 1: Write failing tests — `lib/portfolio/trade-store.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/portfolio/trade-store.test.ts`
Expected: FAIL — cannot find module `./trade-store`

- [ ] **Step 3: Implement `lib/portfolio/trade-store.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/portfolio/trade-store.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/portfolio/trade-store.ts lib/portfolio/trade-store.test.ts
git commit -m "feat: add trade store with localStorage persistence"
```

---

### Task 3: `useOpenTradePrices` hook

Fetches live current prices for open positions' symbols in one batched call (Binance's `fetchTicker24hr` already accepts an array of symbols), matching the `useStaleAwareQuery` pattern used by every prior phase's data hook.

**Files:**
- Create: `lib/query/use-open-trade-prices.ts`, `lib/query/use-open-trade-prices.test.tsx`

- [ ] **Step 1: Write failing tests — `lib/query/use-open-trade-prices.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useOpenTradePrices } from "./use-open-trade-prices";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useOpenTradePrices", () => {
  it("fetches current prices for the given symbols and returns a symbol-to-price map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                symbol: "BTCUSDT",
                lastPrice: "60000.00",
                priceChangePercent: "1.5",
                highPrice: "61000",
                lowPrice: "59000",
                volume: "100",
                quoteVolume: "6000000",
              },
              {
                symbol: "ETHUSDT",
                lastPrice: "3000.00",
                priceChangePercent: "2.0",
                highPrice: "3100",
                lowPrice: "2900",
                volume: "500",
                quoteVolume: "1500000",
              },
            ]),
        } as Response)
      )
    );

    const { result } = renderHook(() => useOpenTradePrices(["BTCUSDT", "ETHUSDT"]), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({ BTCUSDT: 60000, ETHUSDT: 3000 }));

    vi.unstubAllGlobals();
  });

  it("returns an empty object without fetching when given no symbols", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOpenTradePrices([]), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual({}));
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/query/use-open-trade-prices.test.tsx`
Expected: FAIL — cannot find module `./use-open-trade-prices`

- [ ] **Step 3: Implement `lib/query/use-open-trade-prices.ts`**

```ts
import { useStaleAwareQuery, type StaleAwareResult } from "./use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";

async function fetchPricesForSymbols(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const tickers = await fetchTicker24hr(symbols);
  const prices: Record<string, number> = {};
  for (const ticker of tickers) {
    prices[ticker.symbol] = ticker.lastPrice;
  }
  return prices;
}

export function useOpenTradePrices(symbols: string[]): StaleAwareResult<Record<string, number>> {
  const uniqueSymbols = Array.from(new Set(symbols)).sort();
  return useStaleAwareQuery({
    queryKey: ["openTradePrices", uniqueSymbols],
    queryFn: () => fetchPricesForSymbols(uniqueSymbols),
    refetchInterval: 30_000,
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/query/use-open-trade-prices.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/query/use-open-trade-prices.ts lib/query/use-open-trade-prices.test.tsx
git commit -m "feat: add useOpenTradePrices hook"
```

---

### Task 4: Trade form

The log-a-trade form. Unlike Phase 3's `TradeInputForm` (which is controlled by its parent for live recalculation), this form owns its own field state internally and calls `onSubmit` once with a fully-parsed trade on submission — Trade Desk doesn't need the parent to see every keystroke.

**Files:**
- Create: `components/portfolio/trade-form.tsx`, `components/portfolio/trade-form.test.tsx`

- [ ] **Step 1: Write failing tests — `components/portfolio/trade-form.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeForm } from "./trade-form";

describe("TradeForm", () => {
  it("submits a fully-filled trade with the correct parsed shape", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Stop Loss (optional)"), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText("Take Profit (optional)"), { target: { value: "110" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Breakout play" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      direction: "long",
      entryPrice: 100,
      stopLossPrice: 95,
      takeProfitPrice: 110,
      units: 2,
      notes: "Breakout play",
    });
  });

  it("submits with null stop-loss and take-profit when left empty", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ stopLossPrice: null, takeProfitPrice: null })
    );
  });

  it("switches direction to short when the Short button is clicked", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Short" }));
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ direction: "short" }));
  });

  it("does not submit when entry price or units is missing", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/portfolio/trade-form.test.tsx`
Expected: FAIL — cannot find module `./trade-form`

- [ ] **Step 3: Implement `components/portfolio/trade-form.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { CURATED_SYMBOLS, DEFAULT_SYMBOL } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TradeDirection } from "@/lib/portfolio/types";

export interface NewTradeInput {
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  units: number;
  notes: string;
}

export interface TradeFormProps {
  onSubmit: (trade: NewTradeInput) => void;
}

const FIELD_CLASS = "rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none";

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function TradeForm({ onSubmit }: TradeFormProps) {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [direction, setDirection] = useState<TradeDirection>("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [units, setUnits] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedEntry = Number(entryPrice);
    const parsedUnits = Number(units);
    if (!Number.isFinite(parsedEntry) || !Number.isFinite(parsedUnits) || parsedUnits <= 0) return;

    onSubmit({
      symbol,
      direction,
      entryPrice: parsedEntry,
      stopLossPrice: parseOptionalNumber(stopLossPrice),
      takeProfitPrice: parseOptionalNumber(takeProfitPrice),
      units: parsedUnits,
      notes,
    });

    setEntryPrice("");
    setStopLossPrice("");
    setTakeProfitPrice("");
    setUnits("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <label className="flex flex-col gap-1 text-sm">
            Symbol
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={FIELD_CLASS}>
              {CURATED_SYMBOLS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Direction
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "long" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("long")}
              >
                Long
              </Button>
              <Button
                type="button"
                variant={direction === "short" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("short")}
              >
                Short
              </Button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Entry Price
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Stop Loss (optional)
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Take Profit (optional)
            <input
              type="number"
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Units
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <div className="flex items-end sm:col-span-3 lg:col-span-7">
            <Button type="submit">Log Trade</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/portfolio/trade-form.test.tsx`
Expected: PASS (4 tests). `DEFAULT_SYMBOL` (from `lib/symbols.ts`) is `"BTCUSDT"` — confirmed during planning — which is why the first test asserts that literal value.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/portfolio/trade-form.tsx components/portfolio/trade-form.test.tsx
git commit -m "feat: add trade form"
```

---

### Task 5: Trade row

Renders one trade, adapting to open (live unrealized PnL, a Close action revealing an inline exit-price input) vs. closed (final realized PnL from the stored exit price, no Close action). Both states have a Delete action.

**Files:**
- Create: `components/portfolio/trade-row.tsx`, `components/portfolio/trade-row.test.tsx`

- [ ] **Step 1: Write failing tests — `components/portfolio/trade-row.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeRow } from "./trade-row";
import type { Trade } from "@/lib/portfolio/types";

const openTrade: Trade = {
  id: "1",
  symbol: "BTCUSDT",
  direction: "long",
  entryPrice: 100,
  stopLossPrice: 95,
  takeProfitPrice: 110,
  units: 2,
  openedAt: 1700000000000,
  exitPrice: null,
  closedAt: null,
  notes: "",
};

const closedTrade: Trade = {
  ...openTrade,
  id: "2",
  exitPrice: 110,
  closedAt: 1700001000000,
};

describe("TradeRow", () => {
  it("shows live unrealized PnL for an open trade when a current price is provided", () => {
    render(<TradeRow trade={openTrade} currentPrice={110} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/20\.00/)).toBeInTheDocument();
  });

  it("shows a live-price-unavailable message for an open trade with no current price", () => {
    render(<TradeRow trade={openTrade} onClose={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/live price unavailable/i)).toBeInTheDocument();
  });

  it("shows realized PnL for a closed trade using its stored exit price, ignoring currentPrice", () => {
    render(<TradeRow trade={closedTrade} currentPrice={999} onDelete={vi.fn()} />);
    expect(screen.getByText(/20\.00/)).toBeInTheDocument();
  });

  it("does not show a Close action for a closed trade", () => {
    render(<TradeRow trade={closedTrade} onDelete={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("reveals an exit-price input and calls onClose with the parsed value when confirmed", () => {
    const onClose = vi.fn();
    render(<TradeRow trade={openTrade} currentPrice={105} onClose={onClose} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByPlaceholderText("Exit price"), { target: { value: "108" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onClose).toHaveBeenCalledWith("1", 108);
  });

  it("calls onDelete with the trade id when Delete is clicked", () => {
    const onDelete = vi.fn();
    render(<TradeRow trade={openTrade} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/portfolio/trade-row.test.tsx`
Expected: FAIL — cannot find module `./trade-row`

- [ ] **Step 3: Implement `components/portfolio/trade-row.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeTradePnl } from "@/lib/portfolio/calculations";
import { formatPrice, formatPercent } from "@/lib/format";
import type { Trade } from "@/lib/portfolio/types";

export interface TradeRowProps {
  trade: Trade;
  currentPrice?: number;
  onClose?: (id: string, exitPrice: number) => void;
  onDelete: (id: string) => void;
}

export function TradeRow({ trade, currentPrice, onClose, onDelete }: TradeRowProps) {
  const [showCloseInput, setShowCloseInput] = useState(false);
  const [exitPriceInput, setExitPriceInput] = useState("");

  const isOpen = trade.closedAt === null;
  const priceForPnl = isOpen ? currentPrice : trade.exitPrice ?? undefined;
  const pnl = priceForPnl !== undefined ? computeTradePnl(trade, priceForPnl) : null;

  function handleConfirmClose() {
    const parsed = Number(exitPriceInput);
    if (!Number.isFinite(parsed) || !onClose) return;
    onClose(trade.id, parsed);
    setShowCloseInput(false);
    setExitPriceInput("");
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <Badge variant={trade.direction === "long" ? "up" : "down"}>{trade.direction}</Badge>
          <span className="text-sm font-medium">{trade.symbol}</span>
          <span className="text-xs text-muted-foreground">
            Entry: {formatPrice(trade.entryPrice)} × {trade.units}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {pnl ? (
            <span className={`text-sm font-medium ${pnl.pnlAmount >= 0 ? "text-up" : "text-down"}`}>
              {formatPrice(pnl.pnlAmount)} ({formatPercent(pnl.pnlPercent)})
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Live price unavailable</span>
          )}
          {isOpen && onClose && !showCloseInput && (
            <Button size="sm" variant="outline" onClick={() => setShowCloseInput(true)}>
              Close
            </Button>
          )}
          {isOpen && onClose && showCloseInput && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Exit price"
                value={exitPriceInput}
                onChange={(e) => setExitPriceInput(e.target.value)}
                className="w-24 rounded-lg border border-border bg-muted px-2 py-1 text-xs outline-none"
              />
              <Button size="sm" onClick={handleConfirmClose}>
                Confirm
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(trade.id)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/portfolio/trade-row.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/portfolio/trade-row.tsx components/portfolio/trade-row.test.tsx
git commit -m "feat: add trade row component"
```

---

### Task 6: Stats summary

Renders `computePortfolioStats`'s output as a stat grid for the Portfolio page.

**Files:**
- Create: `components/portfolio/stats-summary.tsx`, `components/portfolio/stats-summary.test.tsx`

- [ ] **Step 1: Write failing tests — `components/portfolio/stats-summary.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsSummary } from "./stats-summary";
import type { PortfolioStats } from "@/lib/portfolio/calculations";

const baseStats: PortfolioStats = {
  totalRealizedPnl: 150,
  totalUnrealizedPnl: -30,
  winRate: 66.67,
  averageRiskRewardAchieved: 2.5,
  openRiskPercent: 1.25,
};

describe("StatsSummary", () => {
  it("renders realized and unrealized PnL, win rate, average R:R, and open risk", () => {
    render(<StatsSummary stats={baseStats} />);
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.getByText("$-30.00")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
    expect(screen.getByText("1:2.50")).toBeInTheDocument();
    expect(screen.getByText("1.25%")).toBeInTheDocument();
  });

  it("shows a dash for average risk:reward when no trade has a defined stop-loss", () => {
    render(<StatsSummary stats={{ ...baseStats, averageRiskRewardAchieved: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/portfolio/stats-summary.test.tsx`
Expected: FAIL — cannot find module `./stats-summary`

- [ ] **Step 3: Implement `components/portfolio/stats-summary.tsx`**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { PortfolioStats } from "@/lib/portfolio/calculations";

export interface StatsSummaryProps {
  stats: PortfolioStats;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Stats</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Realized PnL</span>
          <span className={`text-sm font-medium ${stats.totalRealizedPnl >= 0 ? "text-up" : "text-down"}`}>
            ${formatPrice(stats.totalRealizedPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Unrealized PnL</span>
          <span className={`text-sm font-medium ${stats.totalUnrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
            ${formatPrice(stats.totalUnrealizedPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-sm font-medium">{stats.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Avg R:R Achieved</span>
          <span className="text-sm font-medium">
            {stats.averageRiskRewardAchieved === null ? "—" : `1:${stats.averageRiskRewardAchieved.toFixed(2)}`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Open Risk</span>
          <span className="text-sm font-medium">{stats.openRiskPercent.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/portfolio/stats-summary.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/portfolio/stats-summary.tsx components/portfolio/stats-summary.test.tsx
git commit -m "feat: add portfolio stats summary component"
```

---

### Task 7: Trade Desk page

Replaces the `ComingSoon` placeholder at `/trade-desk`. Composes the form and the open-trades list, wiring live prices in for unrealized PnL.

**Files:**
- Modify: `app/trade-desk/page.tsx` (currently `<ComingSoon title="Trade Desk" />` from Phase 1)
- Create: `app/trade-desk/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/trade-desk/page.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Trade } from "@/lib/portfolio/types";

const openTrade: Trade = {
  id: "1",
  symbol: "BTCUSDT",
  direction: "long",
  entryPrice: 100,
  stopLossPrice: 95,
  takeProfitPrice: 110,
  units: 1,
  openedAt: 1700000000000,
  exitPrice: null,
  closedAt: null,
  notes: "",
};

const closedTrade: Trade = { ...openTrade, id: "2", exitPrice: 110, closedAt: 1700001000000 };

const mockAddTrade = vi.fn();
const mockCloseTrade = vi.fn();
const mockDeleteTrade = vi.fn();
const mockUseTradeStore = vi.fn();

vi.mock("@/lib/portfolio/trade-store", () => ({
  useTradeStore: (selector: (s: unknown) => unknown) => selector(mockUseTradeStore()),
  hydrateTradesFromStorage: vi.fn(),
}));

vi.mock("@/lib/query/use-open-trade-prices", () => ({
  useOpenTradePrices: () => ({ data: { BTCUSDT: 105 }, isLoading: false, isStale: false }),
}));

import TradeDeskPage from "./page";

describe("TradeDeskPage", () => {
  beforeEach(() => {
    mockAddTrade.mockClear();
    mockCloseTrade.mockClear();
    mockDeleteTrade.mockClear();
    mockUseTradeStore.mockReturnValue({
      trades: [openTrade, closedTrade],
      addTrade: mockAddTrade,
      closeTrade: mockCloseTrade,
      deleteTrade: mockDeleteTrade,
    });
  });

  it("renders only open trades in the Open Positions list", () => {
    render(<TradeDeskPage />);
    expect(screen.getAllByText("BTCUSDT")).toHaveLength(1);
  });

  it("shows the empty state when there are no open trades", () => {
    mockUseTradeStore.mockReturnValue({
      trades: [closedTrade],
      addTrade: mockAddTrade,
      closeTrade: mockCloseTrade,
      deleteTrade: mockDeleteTrade,
    });
    render(<TradeDeskPage />);
    expect(screen.getByText(/no trades logged yet/i)).toBeInTheDocument();
  });

  it("calls addTrade with a generated id and openedAt when the form is submitted", () => {
    render(<TradeDeskPage />);
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(mockAddTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        entryPrice: 200,
        units: 1,
        exitPrice: null,
        closedAt: null,
      })
    );
    const submittedTrade = mockAddTrade.mock.calls[0][0];
    expect(typeof submittedTrade.id).toBe("string");
    expect(typeof submittedTrade.openedAt).toBe("number");
  });

  it("calls closeTrade with the trade id, parsed exit price, and a timestamp when a trade is closed", () => {
    render(<TradeDeskPage />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByPlaceholderText("Exit price"), { target: { value: "108" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(mockCloseTrade).toHaveBeenCalledWith("1", 108, expect.any(Number));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/trade-desk/page.test.tsx`
Expected: FAIL — the current `ComingSoon` placeholder doesn't render any of this

- [ ] **Step 3: Replace `app/trade-desk/page.tsx`**

```tsx
"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTradeStore, hydrateTradesFromStorage } from "@/lib/portfolio/trade-store";
import { useOpenTradePrices } from "@/lib/query/use-open-trade-prices";
import { TradeForm, type NewTradeInput } from "@/components/portfolio/trade-form";
import { TradeRow } from "@/components/portfolio/trade-row";

function generateTradeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TradeDeskPage() {
  const trades = useTradeStore((s) => s.trades);
  const addTrade = useTradeStore((s) => s.addTrade);
  const closeTrade = useTradeStore((s) => s.closeTrade);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);

  useLayoutEffect(() => {
    hydrateTradesFromStorage();
  }, []);

  const openTrades = useMemo(() => trades.filter((t) => t.closedAt === null), [trades]);
  const openSymbols = useMemo(() => openTrades.map((t) => t.symbol), [openTrades]);
  const { data: prices } = useOpenTradePrices(openSymbols);

  function handleSubmit(input: NewTradeInput) {
    addTrade({
      id: generateTradeId(),
      ...input,
      openedAt: Date.now(),
      exitPrice: null,
      closedAt: null,
    });
  }

  function handleClose(id: string, exitPrice: number) {
    closeTrade(id, exitPrice, Date.now());
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Trade Desk</h1>
        <p className="text-sm text-muted-foreground">Log new trades and track your open positions.</p>
      </div>
      <TradeForm onSubmit={handleSubmit} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Open Positions</h2>
        {openTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades logged yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {openTrades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                currentPrice={prices?.[trade.symbol]}
                onClose={handleClose}
                onDelete={deleteTrade}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/trade-desk/page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add app/trade-desk/page.tsx app/trade-desk/page.test.tsx
git commit -m "feat: compose the trade desk page"
```

---

### Task 8: Portfolio page

Replaces the `ComingSoon` placeholder at `/portfolio`. Composes the stats summary and closed-trades history, reusing Phase 3's account balance for the open-risk-percentage stat.

**Files:**
- Modify: `app/portfolio/page.tsx` (currently `<ComingSoon title="Portfolio" />` from Phase 1)
- Create: `app/portfolio/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/portfolio/page.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Trade } from "@/lib/portfolio/types";

const openTrade: Trade = {
  id: "1",
  symbol: "BTCUSDT",
  direction: "long",
  entryPrice: 100,
  stopLossPrice: 95,
  takeProfitPrice: 110,
  units: 1,
  openedAt: 1700000000000,
  exitPrice: null,
  closedAt: null,
  notes: "",
};

const closedTrade: Trade = { ...openTrade, id: "2", symbol: "ETHUSDT", exitPrice: 110, closedAt: 1700001000000 };

const mockDeleteTrade = vi.fn();
const mockUseTradeStore = vi.fn();

vi.mock("@/lib/portfolio/trade-store", () => ({
  useTradeStore: (selector: (s: unknown) => unknown) => selector(mockUseTradeStore()),
  hydrateTradesFromStorage: vi.fn(),
}));

vi.mock("@/lib/analyzer/account-settings-store", () => ({
  useAccountSettingsStore: (selector: (s: unknown) => unknown) => selector({ accountBalance: 10000, riskPercent: 1 }),
}));

vi.mock("@/lib/query/use-open-trade-prices", () => ({
  useOpenTradePrices: () => ({ data: { BTCUSDT: 105 }, isLoading: false, isStale: false }),
}));

import PortfolioPage from "./page";

describe("PortfolioPage", () => {
  beforeEach(() => {
    mockDeleteTrade.mockClear();
    mockUseTradeStore.mockReturnValue({
      trades: [openTrade, closedTrade],
      deleteTrade: mockDeleteTrade,
    });
  });

  it("renders the stats summary and only closed trades in the history list", () => {
    render(<PortfolioPage />);
    expect(screen.getByText("Portfolio Stats")).toBeInTheDocument();
    expect(screen.getAllByText("ETHUSDT")).toHaveLength(1);
    expect(screen.queryByText("BTCUSDT")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no closed trades", () => {
    mockUseTradeStore.mockReturnValue({ trades: [openTrade], deleteTrade: mockDeleteTrade });
    render(<PortfolioPage />);
    expect(screen.getByText(/no closed trades yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/portfolio/page.test.tsx`
Expected: FAIL — the current `ComingSoon` placeholder doesn't render any of this

- [ ] **Step 3: Replace `app/portfolio/page.tsx`**

```tsx
"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTradeStore, hydrateTradesFromStorage } from "@/lib/portfolio/trade-store";
import { useAccountSettingsStore } from "@/lib/analyzer/account-settings-store";
import { useOpenTradePrices } from "@/lib/query/use-open-trade-prices";
import { computePortfolioStats } from "@/lib/portfolio/calculations";
import { StatsSummary } from "@/components/portfolio/stats-summary";
import { TradeRow } from "@/components/portfolio/trade-row";

export default function PortfolioPage() {
  const trades = useTradeStore((s) => s.trades);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);
  const accountBalance = useAccountSettingsStore((s) => s.accountBalance);

  useLayoutEffect(() => {
    hydrateTradesFromStorage();
  }, []);

  const closedTrades = useMemo(() => trades.filter((t) => t.closedAt !== null), [trades]);
  const openSymbols = useMemo(
    () => trades.filter((t) => t.closedAt === null).map((t) => t.symbol),
    [trades]
  );
  const { data: prices } = useOpenTradePrices(openSymbols);

  const stats = useMemo(
    () => computePortfolioStats(trades, accountBalance, prices ?? {}),
    [trades, accountBalance, prices]
  );

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your trading performance at a glance.</p>
      </div>
      <StatsSummary stats={stats} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Closed Trades</h2>
        {closedTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {closedTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} onDelete={deleteTrade} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/portfolio/page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full test suite and production build**

Run: `npx vitest run`
Expected: PASS — every test file from this plan plus everything from Phases 1-5 passes.

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/portfolio/page.tsx app/portfolio/page.test.tsx
git commit -m "feat: compose the portfolio page"
```

---

### Task 9: Manual browser verification

The full log → live-price → close → stats-update loop, and `localStorage` persistence across a reload, can't be verified by the test suite. Mirrors every prior phase's final task — and since this is the final phase of the whole platform, this is also the last manual check of the project.

**Files:** none (verification only; fix forward in the relevant task's files if something's broken)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running). Check for and stop any stale process already listening on port 3000 first (a prior phase in this project found a stale dev server silently causing a second instance to start on port 3001, producing misleading verification results).

- [ ] **Step 2: Log a real trade on `/trade-desk`**

Navigate to `http://localhost:3000/trade-desk`. Fill in a real symbol, entry price near its actual current value (check Markets for a real current price first), a stop-loss, a take-profit, units, and submit. Confirm it appears in Open Positions with a live unrealized PnL that updates to reflect the real current price (not stuck at zero or showing "live price unavailable" for a real, actively-traded symbol like BTCUSDT).

- [ ] **Step 3: Close the trade**

Click "Close" on the logged trade, enter a realistic exit price, confirm. Confirm the trade disappears from Open Positions.

- [ ] **Step 4: Check the closed trade and stats on `/portfolio`**

Navigate to `/portfolio`. Confirm the closed trade appears in Closed Trades with the correct realized PnL (compute it by hand from the entry/exit/units/direction you used and compare). Confirm Portfolio Stats reflects it: Realized PnL matches, Win Rate is 100% or 0% depending on whether you closed at a profit or loss, and Average R:R Achieved shows a real number (since you set a stop-loss) rather than a dash.

- [ ] **Step 5: Check persistence across a reload**

Reload `/portfolio`. Confirm the closed trade and stats are still there (not reset to empty) — this confirms `localStorage` persistence and the hydration pattern both work correctly, with no hydration-mismatch console error.

- [ ] **Step 6: Log a second trade and leave it open, then check both pages together**

Log another trade on `/trade-desk` and leave it open. Confirm `/portfolio`'s Open Risk stat reflects it (only if you set a stop-loss on it) and that it does NOT appear in `/portfolio`'s Closed Trades list.

- [ ] **Step 7: Test the empty states**

Using browser devtools, clear this site's `localStorage` for `trade-desk-trades`, then reload both `/trade-desk` and `/portfolio`. Confirm both show their empty-state messages ("No trades logged yet." / "No closed trades yet.") rather than a blank area or a stats grid full of zeros looking broken (a `0%`/`$0.00` stats grid with a dash for average R:R is expected and fine — just confirm it doesn't crash or show `NaN`/`undefined` anywhere).

- [ ] **Step 8: Check the browser console**

No uncaught errors during any of the above steps.

- [ ] **Step 9: Toggle light mode**

Confirm both pages, the form, trade rows (including the long/short direction badges and the exit-price input), and the stats grid all re-theme correctly with readable contrast in both themes.

- [ ] **Step 10: Fix forward if anything's broken**

If any check above fails, fix it in the relevant component/lib file, re-run that task's test file, and repeat this task's browser check before continuing.

- [ ] **Step 11: Stop the dev server and do a final commit if any fixes were made**

If Step 10 required changes:

```bash
git add -A
git commit -m "fix: address issues found in manual browser verification"
```

If no changes were needed, this task requires no commit.

---

## Plan Self-Review

**Spec coverage:** every section of the approved design spec
(`docs/superpowers/specs/2026-09-08-portfolio-trade-desk-design.md`)
maps to a task — the shared `Trade` data model and PnL/stats math (Task
1), `localStorage`-backed persistence mirroring Phase 3's proven
pattern (Task 2), live prices for open positions only (Task 3), the
log-a-trade form (Task 4), the adaptive open/closed trade row with
close and delete actions (Task 5), the aggregate stats display (Task
6), and both pages (Tasks 7-8). The spec's non-goals (no exchange
integration, no strategy tagging, no in-place trade editing, no
multi-account support, no export/import) are respected — no task
builds any of these. Reuse of Phase 3's account balance (rather than a
second balance concept) is implemented in Task 8's `useAccountSettingsStore`
call, not a new store.

**Placeholder scan:** no TBD/TODO markers; every step has complete,
runnable code or an exact command with expected output.

**Type consistency:** `Trade`/`TradeDirection` (Task 1's
`lib/portfolio/types.ts`) are used identically by `calculations.ts`
(Task 1), `trade-store.ts` (Task 2), `trade-form.tsx`'s `NewTradeInput`
(Task 4, a subset matching every field except `id`/`openedAt`/
`exitPrice`/`closedAt`, which the page fills in), `trade-row.tsx`
(Task 5), and both pages (Tasks 7-8). `PortfolioStats` (Task 1) is
consumed unchanged by `stats-summary.tsx` (Task 6) and computed by the
Portfolio page (Task 8). `TRADE_STORAGE_KEY`/`useTradeStore`/
`hydrateTradesFromStorage`/`loadPersistedTrades` (Task 2) are the
single source of truth for trade persistence, reused unchanged by both
pages. No drift between where any type/function is defined and where
it's called.
