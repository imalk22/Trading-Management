import type { GeneratedCandle } from "./rng";

export interface TradeOutcome {
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  exitIndex: number;
  exitReason: "take-profit" | "stop-loss" | "end-of-data";
}

/**
 * Derives a trade's stop-loss/take-profit levels from the recent swing
 * low (long) or swing high (short) before entry, using a 2:1 reward-to-risk
 * ratio, then scans forward to find which level the price actually reaches
 * first.
 */
export function computeTrade(
  candles: GeneratedCandle[],
  entryIndex: number,
  entryType: "long" | "short",
  lookbackForStop = 10,
  rewardMultiple = 2
): TradeOutcome {
  const entryPrice = candles[entryIndex].close;
  const lookbackStart = Math.max(0, entryIndex - lookbackForStop);
  const lookbackCandles = candles.slice(lookbackStart, entryIndex + 1);

  let stopLossPrice: number;
  let takeProfitPrice: number;

  if (entryType === "long") {
    stopLossPrice = Math.min(...lookbackCandles.map((c) => c.low));
    const risk = entryPrice - stopLossPrice;
    takeProfitPrice = entryPrice + risk * rewardMultiple;
  } else {
    stopLossPrice = Math.max(...lookbackCandles.map((c) => c.high));
    const risk = stopLossPrice - entryPrice;
    takeProfitPrice = entryPrice - risk * rewardMultiple;
  }

  let exitIndex = candles.length - 1;
  let exitReason: TradeOutcome["exitReason"] = "end-of-data";

  for (let i = entryIndex + 1; i < candles.length; i++) {
    const candle = candles[i];
    if (entryType === "long") {
      if (candle.low <= stopLossPrice) {
        exitIndex = i;
        exitReason = "stop-loss";
        break;
      }
      if (candle.high >= takeProfitPrice) {
        exitIndex = i;
        exitReason = "take-profit";
        break;
      }
    } else {
      if (candle.high >= stopLossPrice) {
        exitIndex = i;
        exitReason = "stop-loss";
        break;
      }
      if (candle.low <= takeProfitPrice) {
        exitIndex = i;
        exitReason = "take-profit";
        break;
      }
    }
  }

  return { entryPrice, stopLossPrice, takeProfitPrice, exitIndex, exitReason };
}
