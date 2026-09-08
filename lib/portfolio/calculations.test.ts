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
