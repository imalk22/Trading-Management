"use client";

import { useStaleAwareQuery, type StaleAwareResult } from "@/lib/query/use-stale-query";
import { fetchKlines } from "@/lib/binance/rest";
import { sma, ema, rsi, rollingStdev } from "@/lib/strategies/indicators";
import {
  detectMovingAverageCrossover,
  detectRsiMeanReversion,
  detectSupportResistanceBreakout,
  detectBollingerSqueeze,
  detectMacdMomentumCross,
} from "@/lib/strategies/detectors";
import { evaluateHeadAndShouldersLive } from "./head-and-shoulders-live";
import { STRATEGIES, type StrategyCategory } from "@/lib/strategies/data";

export type AlignmentStatus = "aligned" | "not-yet" | "not-applicable";

export interface StrategyAlignment {
  strategyId: string;
  name: string;
  category: StrategyCategory;
  status: AlignmentStatus;
  reason: string;
}

const RESISTANCE_LOOKBACK = 40;
const KLINE_INTERVAL = "1h" as const;
const KLINE_LIMIT = 100;

export function computeStrategyAlignments(
  candles: { high: number; low: number; close: number }[],
  direction: "long" | "short"
): StrategyAlignment[] {
  const closes = candles.map((c) => c.close);
  const i = candles.length - 1;

  const fast = sma(closes, 5);
  const slow = sma(closes, 15);
  const maResult = detectMovingAverageCrossover(fast[i - 1], slow[i - 1], fast[i], slow[i]);

  const rsiValues = rsi(closes, 14);
  const wasOversold = rsiValues.slice(0, i).some((v) => v !== undefined && v < 30);
  const rsiResult = detectRsiMeanReversion(rsiValues[i], wasOversold);

  const resistanceWindow = candles.slice(Math.max(0, i - RESISTANCE_LOOKBACK), i);
  const resistance = resistanceWindow.length > 0 ? Math.max(...resistanceWindow.map((c) => c.high)) : Infinity;
  const srResult = detectSupportResistanceBreakout(closes[i], resistance);

  const middle = sma(closes, 20);
  const width = rollingStdev(closes, 20);
  const bollingerResult = detectBollingerSqueeze(closes[i], middle[i - 1], width[i - 1]);

  const fastEma = ema(closes, 12);
  const slowEma = ema(closes, 26);
  const macdLine: (number | undefined)[] = closes.map((_, idx) => {
    const f = fastEma[idx];
    const s = slowEma[idx];
    return f === undefined || s === undefined ? undefined : f - s;
  });
  const signalStartIndex = macdLine.findIndex((v) => v !== undefined);
  const definedMacd = macdLine.filter((v): v is number => v !== undefined);
  const signalValues = ema(definedMacd, 9);
  const signalLine: (number | undefined)[] = new Array(candles.length).fill(undefined);
  if (signalStartIndex !== -1) {
    signalValues.forEach((value, idx) => {
      signalLine[signalStartIndex + idx] = value;
    });
  }
  const macdResult = detectMacdMomentumCross(macdLine[i - 1], signalLine[i - 1], macdLine[i], signalLine[i]);

  const hsResult = evaluateHeadAndShouldersLive(candles);

  const rawResults: Record<string, { aligned: boolean; reason: string }> = {
    "moving-average-crossover": maResult,
    "rsi-mean-reversion": rsiResult,
    "support-resistance-breakout": srResult,
    "bollinger-band-squeeze": bollingerResult,
    "macd-momentum-cross": macdResult,
    "head-and-shoulders-reversal": hsResult,
  };

  return STRATEGIES.map((strategy) => {
    if (strategy.entryType !== direction) {
      return {
        strategyId: strategy.id,
        name: strategy.name,
        category: strategy.category,
        status: "not-applicable" as const,
        reason: `this pattern is ${strategy.entryType}-only`,
      };
    }
    const raw = rawResults[strategy.id];
    return {
      strategyId: strategy.id,
      name: strategy.name,
      category: strategy.category,
      status: raw.aligned ? ("aligned" as const) : ("not-yet" as const),
      reason: raw.reason,
    };
  });
}

export function useLiveStrategyCheck(
  symbol: string,
  direction: "long" | "short" | "invalid"
): StaleAwareResult<StrategyAlignment[]> {
  const { data: klines, isStale, isLoading } = useStaleAwareQuery({
    queryKey: ["analyzerKlines", symbol],
    queryFn: () => fetchKlines(symbol, KLINE_INTERVAL, KLINE_LIMIT),
    refetchInterval: 60_000,
  });

  const data = klines && direction !== "invalid" ? computeStrategyAlignments(klines, direction) : undefined;

  return { data, isStale, isLoading };
}
