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

  const tradesWithRisk = closedTrades.filter((t) => t.stopLossPrice !== null && t.stopLossPrice !== t.entryPrice);
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
