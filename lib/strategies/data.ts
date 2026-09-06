import { generateWalk, type GeneratedCandle } from "./rng";
import { sma, ema, rsi, rollingStdev } from "./indicators";
import { computeTrade, type TradeOutcome } from "./trade";

export type StrategyCategory =
  | "Trend Following"
  | "Mean Reversion"
  | "Breakout"
  | "Volatility Breakout"
  | "Momentum"
  | "Chart Pattern";

export interface Strategy extends TradeOutcome {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  candles: GeneratedCandle[];
  entryIndex: number;
  entryType: "long" | "short";
}

function buildMovingAverageCrossover(): Strategy {
  const candles = generateWalk({
    seed: 1,
    count: 60,
    startPrice: 100,
    driftAt: (i) => (i < 20 ? -0.05 : 0.35),
    volatilityAt: () => 1,
  });
  const closes = candles.map((c) => c.close);
  const fast = sma(closes, 5);
  const slow = sma(closes, 15);

  let entryIndex = 20;
  for (let i = 15; i < candles.length; i++) {
    const prevFast = fast[i - 1];
    const prevSlow = slow[i - 1];
    const curFast = fast[i];
    const curSlow = slow[i];
    if (prevFast === undefined || prevSlow === undefined || curFast === undefined || curSlow === undefined) continue;
    if (prevFast <= prevSlow && curFast > curSlow) {
      entryIndex = i;
      break;
    }
  }

  return {
    id: "moving-average-crossover",
    name: "Moving Average Crossover",
    category: "Trend Following",
    description:
      "A fast moving average (5-period) crossing above a slower one (15-period) signals that short-term momentum has turned upward relative to the longer-term trend. The strategy enters long on the cross and places a stop below the recent swing low, targeting a move at least twice the size of the risk.",
    candles,
    entryIndex,
    entryType: "long",
    ...computeTrade(candles, entryIndex, "long"),
  };
}

function buildRsiMeanReversion(): Strategy {
  const candles = generateWalk({
    seed: 2,
    count: 50,
    startPrice: 100,
    driftAt: (i) => (i < 25 ? -0.4 : 0.5),
    volatilityAt: () => 1,
  });
  const closes = candles.map((c) => c.close);
  const rsiValues = rsi(closes, 14);

  let entryIndex = 26;
  let wasOversold = false;
  for (let i = 14; i < candles.length; i++) {
    const value = rsiValues[i];
    if (value === undefined) continue;
    if (value < 30) wasOversold = true;
    else if (wasOversold && value >= 30) {
      entryIndex = i;
      break;
    }
  }

  return {
    id: "rsi-mean-reversion",
    name: "RSI Mean Reversion",
    category: "Mean Reversion",
    description:
      "When the 14-period RSI drops below 30, the asset is considered oversold and due for a bounce. Rather than buying the dip itself, this strategy waits for RSI to climb back above 30 — confirming the reversal has actually started — before entering long.",
    candles,
    entryIndex,
    entryType: "long",
    ...computeTrade(candles, entryIndex, "long"),
  };
}

function buildSupportResistanceBreakout(): Strategy {
  const consolidationLength = 40;
  const candles = generateWalk({
    seed: 3,
    count: 55,
    startPrice: 100,
    driftAt: (i) => (i < consolidationLength ? 0 : 0.6),
    volatilityAt: (i) => (i < consolidationLength ? 0.6 : 1.2),
  });
  const resistance = Math.max(...candles.slice(0, consolidationLength).map((c) => c.high));

  let entryIndex = consolidationLength;
  for (let i = consolidationLength; i < candles.length; i++) {
    if (candles[i].close > resistance) {
      entryIndex = i;
      break;
    }
  }

  return {
    id: "support-resistance-breakout",
    name: "Support/Resistance Breakout",
    category: "Breakout",
    description:
      "Price consolidates in a tight range for an extended period, building resistance at the top of the range. A candle that closes above that resistance signals buyers have taken control, and the strategy enters long on the breakout close.",
    candles,
    entryIndex,
    entryType: "long",
    ...computeTrade(candles, entryIndex, "long"),
  };
}

function buildBollingerSqueeze(): Strategy {
  const squeezeLength = 35;
  const candles = generateWalk({
    seed: 4,
    count: 55,
    startPrice: 100,
    driftAt: (i) => (i < squeezeLength ? 0 : 0.5),
    volatilityAt: (i) => (i < squeezeLength ? 0.3 : 1.8),
  });
  const closes = candles.map((c) => c.close);
  const middle = sma(closes, 20);
  const width = rollingStdev(closes, 20);

  let entryIndex = squeezeLength + 1;
  // Scan only from the end of the squeeze phase onward - starting from the SMA
  // warmup index (20) lets random noise inside the squeeze itself trip a false
  // "breakout" before the intended post-squeeze expansion.
  for (let i = squeezeLength - 1; i < candles.length - 1; i++) {
    const mid = middle[i];
    const w = width[i];
    if (mid === undefined || w === undefined) continue;
    const upperBand = mid + w * 2;
    if (candles[i + 1].close > upperBand) {
      entryIndex = i + 1;
      break;
    }
  }

  return {
    id: "bollinger-band-squeeze",
    name: "Bollinger Band Squeeze",
    category: "Volatility Breakout",
    description:
      "When Bollinger Bands (a 20-period moving average plus/minus 2 standard deviations) contract into a tight squeeze, it signals unusually low volatility that historically precedes a sharp move. The strategy enters long the moment price closes back outside the upper band, catching the expansion early.",
    candles,
    entryIndex,
    entryType: "long",
    ...computeTrade(candles, entryIndex, "long"),
  };
}

function buildMacdMomentumCross(): Strategy {
  const candles = generateWalk({
    seed: 5,
    count: 70,
    startPrice: 100,
    driftAt: (i) => (i < 35 ? -0.1 : 0.3),
    volatilityAt: () => 1,
  });
  const closes = candles.map((c) => c.close);
  const fastEma = ema(closes, 12);
  const slowEma = ema(closes, 26);
  const macdLine: (number | undefined)[] = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f === undefined || s === undefined ? undefined : f - s;
  });
  const signalStartIndex = macdLine.findIndex((v) => v !== undefined);
  const definedMacd = macdLine.filter((v): v is number => v !== undefined);
  const signalValues = ema(definedMacd, 9);
  const signalLine: (number | undefined)[] = new Array(candles.length).fill(undefined);
  signalValues.forEach((value, i) => {
    signalLine[signalStartIndex + i] = value;
  });

  let entryIndex = 40;
  for (let i = 1; i < candles.length; i++) {
    const prevMacd = macdLine[i - 1];
    const prevSignal = signalLine[i - 1];
    const curMacd = macdLine[i];
    const curSignal = signalLine[i];
    if (prevMacd === undefined || prevSignal === undefined || curMacd === undefined || curSignal === undefined) {
      continue;
    }
    if (prevMacd <= prevSignal && curMacd > curSignal) {
      entryIndex = i;
      break;
    }
  }

  return {
    id: "macd-momentum-cross",
    name: "MACD Momentum Cross",
    category: "Momentum",
    description:
      "MACD tracks the relationship between a fast (12-period) and slow (26-period) exponential moving average. When the MACD line crosses above its own 9-period signal line, upward momentum is building — the strategy enters long on that cross.",
    candles,
    entryIndex,
    entryType: "long",
    ...computeTrade(candles, entryIndex, "long"),
  };
}

function buildHeadAndShoulders(): Strategy {
  const phaseLength = 10;
  // Net per-phase moves (ignoring noise) are chosen so the two shoulders land
  // at nearly the same height, both below the head, with the two troughs
  // forming a level neckline: 0 -> 5 (left shoulder) -> 2 (trough1) -> 8 (head)
  // -> 2 (trough2) -> 5 (right shoulder) -> breakdown.
  const driftAt = (i: number) => {
    const phase = Math.floor(i / phaseLength);
    switch (phase) {
      case 0:
        return 0.5; // rise to left shoulder
      case 1:
        return -0.3; // fall to trough 1 (neckline)
      case 2:
        return 0.6; // rise to head (higher than either shoulder)
      case 3:
        return -0.6; // fall to trough 2 (neckline)
      case 4:
        return 0.3; // rise to right shoulder (similar height to left shoulder)
      default:
        return -0.8; // break down through the neckline and continue lower
    }
  };
  const candles = generateWalk({ seed: 21, count: 70, startPrice: 100, driftAt, volatilityAt: () => 0.6 });

  const necklinePrice = Math.min(
    ...candles.slice(phaseLength, phaseLength * 2).map((c) => c.low),
    ...candles.slice(phaseLength * 3, phaseLength * 4).map((c) => c.low)
  );

  let entryIndex = phaseLength * 5;
  for (let i = phaseLength * 5; i < candles.length; i++) {
    if (candles[i].close < necklinePrice) {
      entryIndex = i;
      break;
    }
  }

  return {
    id: "head-and-shoulders-reversal",
    name: "Head & Shoulders Reversal",
    category: "Chart Pattern",
    description:
      "A left shoulder, a higher head, and a right shoulder of similar height to the left form a classic topping pattern — the two troughs between them define a 'neckline.' A close below the neckline confirms the uptrend has reversed, and the strategy enters short on that break.",
    candles,
    entryIndex,
    entryType: "short",
    ...computeTrade(candles, entryIndex, "short"),
  };
}

export const STRATEGIES: Strategy[] = [
  buildMovingAverageCrossover(),
  buildRsiMeanReversion(),
  buildSupportResistanceBreakout(),
  buildBollingerSqueeze(),
  buildMacdMomentumCross(),
  buildHeadAndShoulders(),
];
