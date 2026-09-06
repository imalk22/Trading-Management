# Trade Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-shot trade calculator (`/analyzer`) that computes risk:reward, position size, and max loss/gain for a trader-supplied trade, and runs a live check of which of Phase 2's six strategies' entry conditions are genuinely true right now for the selected symbol.

**Architecture:** Refactor Phase 2's `lib/strategies/data.ts` to extract each strategy's entry-detection logic into reusable pure functions (`lib/strategies/detectors.ts`), verified behavior-preserving via the existing test suite. Build pure calculation/analysis modules under `lib/analyzer/`, then thin presentational components under `components/analyzer/`, then compose them into `app/analyzer/page.tsx`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zustand (account settings persistence), TanStack Query (live data), `lib/binance/rest.ts` (Binance REST), Vitest + Testing Library.

---

### Task 1: Extract shared strategy detectors (refactor)

This is a **behavior-preserving refactor** of already-shipped Phase 2 code. Each of the six `build*()` functions in `lib/strategies/data.ts` currently inlines its own "does the entry condition hold" comparison inside a scan loop. This task extracts each comparison into its own pure, exported function in a new file, then rewires the existing loops to call them. The refactor is verified safe by the fact that `lib/strategies/data.test.ts` (9 existing tests, unchanged) must continue to pass — those tests already pin every strategy's exact `entryIndex`/prices/exit behavior.

**Files:**
- Create: `lib/strategies/detectors.ts`, `lib/strategies/detectors.test.ts`
- Modify: `lib/strategies/data.ts` (six loop bodies only — ids, names, categories, descriptions, seeds, and all generation parameters stay untouched)

- [ ] **Step 1: Write failing tests — `lib/strategies/detectors.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  detectMovingAverageCrossover,
  detectRsiMeanReversion,
  detectSupportResistanceBreakout,
  detectBollingerSqueeze,
  detectMacdMomentumCross,
  detectHeadAndShoulders,
} from "./detectors";

describe("detectMovingAverageCrossover", () => {
  it("is aligned when the fast average just crossed above the slow average", () => {
    const result = detectMovingAverageCrossover(99, 100, 101, 100.5);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when the fast average was already above the slow average", () => {
    const result = detectMovingAverageCrossover(101, 100, 102, 100.2);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when either average isn't available yet", () => {
    const result = detectMovingAverageCrossover(undefined, 100, 101, 100.5);
    expect(result.aligned).toBe(false);
  });
});

describe("detectRsiMeanReversion", () => {
  it("is aligned when RSI has recovered above 30 after a prior oversold dip", () => {
    const result = detectRsiMeanReversion(32, true);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when RSI is above 30 but never dipped oversold first", () => {
    const result = detectRsiMeanReversion(32, false);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when RSI is still below 30", () => {
    const result = detectRsiMeanReversion(25, true);
    expect(result.aligned).toBe(false);
  });

  it("is not aligned when RSI isn't available yet", () => {
    const result = detectRsiMeanReversion(undefined, true);
    expect(result.aligned).toBe(false);
  });
});

describe("detectSupportResistanceBreakout", () => {
  it("is aligned when price closes above resistance", () => {
    expect(detectSupportResistanceBreakout(105, 100).aligned).toBe(true);
  });

  it("is not aligned when price closes below resistance", () => {
    expect(detectSupportResistanceBreakout(98, 100).aligned).toBe(false);
  });
});

describe("detectBollingerSqueeze", () => {
  it("is aligned when price closes above the upper band", () => {
    expect(detectBollingerSqueeze(110, 100, 4).aligned).toBe(true);
  });

  it("is not aligned when price closes inside the upper band", () => {
    expect(detectBollingerSqueeze(105, 100, 4).aligned).toBe(false);
  });

  it("is not aligned when the bands aren't available yet", () => {
    expect(detectBollingerSqueeze(110, undefined, undefined).aligned).toBe(false);
  });
});

describe("detectMacdMomentumCross", () => {
  it("is aligned when MACD just crossed above its signal line", () => {
    const result = detectMacdMomentumCross(-0.5, -0.2, 0.1, 0.05);
    expect(result.aligned).toBe(true);
  });

  it("is not aligned when MACD was already above its signal line", () => {
    const result = detectMacdMomentumCross(0.3, 0.1, 0.4, 0.15);
    expect(result.aligned).toBe(false);
  });
});

describe("detectHeadAndShoulders", () => {
  it("is aligned when price closes below the neckline", () => {
    expect(detectHeadAndShoulders(95, 100).aligned).toBe(true);
  });

  it("is not aligned when price closes above the neckline", () => {
    expect(detectHeadAndShoulders(102, 100).aligned).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/strategies/detectors.test.ts`
Expected: FAIL — cannot find module `./detectors`

- [ ] **Step 3: Implement `lib/strategies/detectors.ts`**

```ts
export interface DetectionResult {
  aligned: boolean;
  reason: string;
}

export function detectMovingAverageCrossover(
  prevFast: number | undefined,
  prevSlow: number | undefined,
  curFast: number | undefined,
  curSlow: number | undefined
): DetectionResult {
  if (prevFast === undefined || prevSlow === undefined || curFast === undefined || curSlow === undefined) {
    return { aligned: false, reason: "not enough data yet for both moving averages" };
  }
  const aligned = prevFast <= prevSlow && curFast > curSlow;
  if (aligned) {
    return {
      aligned: true,
      reason: `fast SMA (${curFast.toFixed(2)}) just crossed above slow SMA (${curSlow.toFixed(2)})`,
    };
  }
  if (curFast > curSlow) {
    return {
      aligned: false,
      reason: `fast SMA (${curFast.toFixed(2)}) is above slow SMA (${curSlow.toFixed(2)}), but the cross already happened`,
    };
  }
  return { aligned: false, reason: `fast SMA (${curFast.toFixed(2)}) is still below slow SMA (${curSlow.toFixed(2)})` };
}

export function detectRsiMeanReversion(rsiValue: number | undefined, wasOversold: boolean): DetectionResult {
  if (rsiValue === undefined) {
    return { aligned: false, reason: "not enough data yet for RSI" };
  }
  if (!wasOversold) {
    return { aligned: false, reason: `RSI is ${rsiValue.toFixed(1)} — no prior dip below 30 to recover from yet` };
  }
  if (rsiValue >= 30) {
    return { aligned: true, reason: `RSI ${rsiValue.toFixed(1)}, recovering from a prior oversold dip below 30` };
  }
  return { aligned: false, reason: `RSI ${rsiValue.toFixed(1)}, still oversold (below 30)` };
}

export function detectSupportResistanceBreakout(close: number, resistance: number): DetectionResult {
  const aligned = close > resistance;
  return {
    aligned,
    reason: aligned
      ? `price closed at ${close.toFixed(2)}, above resistance (${resistance.toFixed(2)})`
      : `price is at ${close.toFixed(2)}, still below resistance (${resistance.toFixed(2)})`,
  };
}

export function detectBollingerSqueeze(
  breakoutClose: number,
  bandMiddle: number | undefined,
  bandWidth: number | undefined
): DetectionResult {
  if (bandMiddle === undefined || bandWidth === undefined) {
    return { aligned: false, reason: "not enough data yet for Bollinger Bands" };
  }
  const upperBand = bandMiddle + bandWidth * 2;
  const aligned = breakoutClose > upperBand;
  return {
    aligned,
    reason: aligned
      ? `price closed at ${breakoutClose.toFixed(2)}, above the upper band (${upperBand.toFixed(2)})`
      : `price is at ${breakoutClose.toFixed(2)}, still inside the upper band (${upperBand.toFixed(2)})`,
  };
}

export function detectMacdMomentumCross(
  prevMacd: number | undefined,
  prevSignal: number | undefined,
  curMacd: number | undefined,
  curSignal: number | undefined
): DetectionResult {
  if (prevMacd === undefined || prevSignal === undefined || curMacd === undefined || curSignal === undefined) {
    return { aligned: false, reason: "not enough data yet for MACD" };
  }
  const aligned = prevMacd <= prevSignal && curMacd > curSignal;
  if (aligned) {
    return {
      aligned: true,
      reason: `MACD line just crossed above its signal line (${curMacd.toFixed(3)} > ${curSignal.toFixed(3)})`,
    };
  }
  if (curMacd > curSignal) {
    return { aligned: false, reason: "MACD line is above its signal line, but the cross already happened" };
  }
  return { aligned: false, reason: "MACD line is still below its signal line" };
}

export function detectHeadAndShoulders(close: number, necklinePrice: number): DetectionResult {
  const aligned = close < necklinePrice;
  return {
    aligned,
    reason: aligned
      ? `price closed at ${close.toFixed(2)}, below the neckline (${necklinePrice.toFixed(2)})`
      : `price is at ${close.toFixed(2)}, still above the neckline (${necklinePrice.toFixed(2)})`,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/strategies/detectors.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Refactor `lib/strategies/data.ts` to use the new detectors**

Replace the entire file with this content. Only the six scan loops changed (each now calls the matching `detect*()` function instead of inlining the comparison) — every id, name, category, description, seed, `count`, `driftAt`, and `volatilityAt` value is byte-for-byte identical to the current file, which is what makes this refactor safe.

```ts
import { generateWalk, type GeneratedCandle } from "./rng";
import { sma, ema, rsi, rollingStdev } from "./indicators";
import { computeTrade, type TradeOutcome } from "./trade";
import {
  detectMovingAverageCrossover,
  detectRsiMeanReversion,
  detectSupportResistanceBreakout,
  detectBollingerSqueeze,
  detectMacdMomentumCross,
  detectHeadAndShoulders,
} from "./detectors";

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
  let found = false;
  for (let i = 15; i < candles.length; i++) {
    if (detectMovingAverageCrossover(fast[i - 1], slow[i - 1], fast[i], slow[i]).aligned) {
      entryIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(
      "moving-average-crossover: no fast/slow SMA crossover found in the generated series - tune seed/drift/volatility"
    );
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
  let found = false;
  let wasOversold = false;
  for (let i = 14; i < candles.length; i++) {
    const value = rsiValues[i];
    if (value === undefined) continue;
    if (value < 30) {
      wasOversold = true;
      continue;
    }
    if (detectRsiMeanReversion(value, wasOversold).aligned) {
      entryIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error("rsi-mean-reversion: no oversold-then-recovery RSI signal found in the generated series - tune seed/drift/volatility");
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
  let found = false;
  for (let i = consolidationLength; i < candles.length; i++) {
    if (detectSupportResistanceBreakout(candles[i].close, resistance).aligned) {
      entryIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(
      "support-resistance-breakout: no close above resistance found in the generated series - tune seed/drift/volatility"
    );
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
  let found = false;
  // Scan only from the end of the squeeze phase onward - starting from the SMA
  // warmup index (20) lets random noise inside the squeeze itself trip a false
  // "breakout" before the intended post-squeeze expansion.
  for (let i = squeezeLength - 1; i < candles.length - 1; i++) {
    if (detectBollingerSqueeze(candles[i + 1].close, middle[i], width[i]).aligned) {
      entryIndex = i + 1;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error(
      "bollinger-band-squeeze: no post-squeeze upper-band breakout found in the generated series - tune seed/drift/volatility"
    );
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
  let found = false;
  for (let i = 1; i < candles.length; i++) {
    if (detectMacdMomentumCross(macdLine[i - 1], signalLine[i - 1], macdLine[i], signalLine[i]).aligned) {
      entryIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error("macd-momentum-cross: no MACD/signal-line crossover found in the generated series - tune seed/drift/volatility");
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
  let found = false;
  for (let i = phaseLength * 5; i < candles.length; i++) {
    if (detectHeadAndShoulders(candles[i].close, necklinePrice).aligned) {
      entryIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error("head-and-shoulders-reversal: no close below the neckline found in the generated series - tune seed/drift/volatility");
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
```

- [ ] **Step 6: Run the full suite to confirm the refactor is behavior-preserving**

Run: `npx vitest run lib/strategies/`
Expected: PASS — `data.test.ts` (9 tests, unchanged file, must still pass with no edits), `detectors.test.ts` (16 tests), plus every other file in `lib/strategies/` (rng, indicators, trade). If ANY `data.test.ts` assertion fails, the refactor introduced a behavioral difference — do not edit `data.test.ts` to make it pass; find and fix the discrepancy between the old inline comparison and the new detector call for the specific strategy that failed.

Then run: `npx vitest run` (full project suite)
Expected: PASS — all 117 pre-existing tests plus this task's 16 new ones (133 total).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 8: Commit**

```bash
git add lib/strategies/detectors.ts lib/strategies/detectors.test.ts lib/strategies/data.ts
git commit -m "refactor: extract strategy entry-detection logic into reusable detectors"
```

---

### Task 2: Trade calculations

Pure, framework-agnostic functions for direction inference, risk:reward, position sizing, and max loss/gain. No React, no network — these are the easiest functions in this plan to get exactly right via tests, and everything else in this phase depends on them.

**Files:**
- Create: `lib/analyzer/calculations.ts`, `lib/analyzer/calculations.test.ts`

- [ ] **Step 1: Write failing tests — `lib/analyzer/calculations.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { inferDirection, computeRiskReward, computePositionSize, computeMaxLossGain } from "./calculations";

describe("inferDirection", () => {
  it("infers long when take-profit is above entry and stop-loss is below entry", () => {
    expect(inferDirection(100, 110, 95)).toBe("long");
  });

  it("infers short when take-profit is below entry and stop-loss is above entry", () => {
    expect(inferDirection(100, 90, 105)).toBe("short");
  });

  it("is invalid when take-profit and stop-loss are on the same side of entry", () => {
    expect(inferDirection(100, 110, 105)).toBe("invalid");
  });

  it("is invalid when stop-loss equals entry price", () => {
    expect(inferDirection(100, 110, 100)).toBe("invalid");
  });

  it("is invalid when take-profit equals entry price", () => {
    expect(inferDirection(100, 100, 95)).toBe("invalid");
  });
});

describe("computeRiskReward", () => {
  it("computes the ratio for a long trade", () => {
    expect(computeRiskReward(100, 110, 95, "long")).toBeCloseTo(2, 5);
  });

  it("computes the ratio for a short trade", () => {
    expect(computeRiskReward(100, 90, 105, "short")).toBeCloseTo(2, 5);
  });
});

describe("computePositionSize", () => {
  it("sizes a position from account balance, risk percent, and the entry-to-stop distance", () => {
    const result = computePositionSize(10000, 1, 100, 95);
    expect(result.units).toBeCloseTo(20, 5);
    expect(result.notionalValue).toBeCloseTo(2000, 5);
  });

  it("returns Infinity units rather than NaN when entry equals stop-loss", () => {
    const result = computePositionSize(10000, 1, 100, 100);
    expect(result.units).toBe(Infinity);
    expect(Number.isNaN(result.units)).toBe(false);
  });
});

describe("computeMaxLossGain", () => {
  it("computes max loss/gain in dollars and percent of account for a long trade", () => {
    const { units } = computePositionSize(10000, 1, 100, 95);
    const result = computeMaxLossGain(units, 10000, 100, 110, 95, "long");
    expect(result.maxLossAmount).toBeCloseTo(100, 5);
    expect(result.maxLossPercent).toBeCloseTo(1, 5);
    expect(result.maxGainAmount).toBeCloseTo(200, 5);
    expect(result.maxGainPercent).toBeCloseTo(2, 5);
  });

  it("computes max loss/gain in dollars and percent of account for a short trade", () => {
    const { units } = computePositionSize(10000, 1, 100, 105);
    const result = computeMaxLossGain(units, 10000, 100, 90, 105, "short");
    expect(result.maxLossAmount).toBeCloseTo(100, 5);
    expect(result.maxLossPercent).toBeCloseTo(1, 5);
    expect(result.maxGainAmount).toBeCloseTo(200, 5);
    expect(result.maxGainPercent).toBeCloseTo(2, 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/analyzer/calculations.test.ts`
Expected: FAIL — cannot find module `./calculations`

- [ ] **Step 3: Implement `lib/analyzer/calculations.ts`**

```ts
export type TradeDirection = "long" | "short" | "invalid";

export function inferDirection(entry: number, takeProfit: number, stopLoss: number): TradeDirection {
  if (takeProfit > entry && stopLoss < entry) return "long";
  if (takeProfit < entry && stopLoss > entry) return "short";
  return "invalid";
}

export function computeRiskReward(
  entry: number,
  takeProfit: number,
  stopLoss: number,
  direction: "long" | "short"
): number {
  const risk = direction === "long" ? entry - stopLoss : stopLoss - entry;
  const reward = direction === "long" ? takeProfit - entry : entry - takeProfit;
  return reward / risk;
}

export interface PositionSize {
  units: number;
  notionalValue: number;
}

export function computePositionSize(
  accountBalance: number,
  riskPercent: number,
  entry: number,
  stopLoss: number
): PositionSize {
  const riskAmount = accountBalance * (riskPercent / 100);
  const riskPerUnit = Math.abs(entry - stopLoss);
  const units = riskAmount / riskPerUnit;
  const notionalValue = units * entry;
  return { units, notionalValue };
}

export interface MaxLossGain {
  maxLossAmount: number;
  maxLossPercent: number;
  maxGainAmount: number;
  maxGainPercent: number;
}

export function computeMaxLossGain(
  units: number,
  accountBalance: number,
  entry: number,
  takeProfit: number,
  stopLoss: number,
  direction: "long" | "short"
): MaxLossGain {
  const lossPerUnit = direction === "long" ? entry - stopLoss : stopLoss - entry;
  const gainPerUnit = direction === "long" ? takeProfit - entry : entry - takeProfit;
  const maxLossAmount = units * lossPerUnit;
  const maxGainAmount = units * gainPerUnit;
  return {
    maxLossAmount,
    maxLossPercent: (maxLossAmount / accountBalance) * 100,
    maxGainAmount,
    maxGainPercent: (maxGainAmount / accountBalance) * 100,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/analyzer/calculations.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/analyzer/calculations.ts lib/analyzer/calculations.test.ts
git commit -m "feat: add trade risk/position-size calculations"
```

---

### Task 3: Account settings store

A small Zustand store holding account balance and risk-per-trade percent, persisted to `localStorage`. To avoid a Next.js hydration mismatch (the server always renders with no `localStorage` access, so the store must start with the same default values on both server and first client render), the store initializes with hardcoded defaults and a separate `hydrateAccountSettingsFromStorage()` function is called from a `useEffect` (client-only, post-hydration) to load any previously saved values. This mirrors the exact class of hydration bug already found and fixed once in Phase 1 (a mismatch between server-rendered and client-rendered attributes) — this task avoids repeating it by construction.

**Files:**
- Create: `lib/analyzer/account-settings-store.ts`, `lib/analyzer/account-settings-store.test.ts`

- [ ] **Step 1: Write failing tests — `lib/analyzer/account-settings-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  useAccountSettingsStore,
  hydrateAccountSettingsFromStorage,
  loadPersistedAccountSettings,
  ACCOUNT_SETTINGS_STORAGE_KEY,
  DEFAULT_ACCOUNT_BALANCE,
  DEFAULT_RISK_PERCENT,
} from "./account-settings-store";

describe("account settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAccountSettingsStore.setState({
      accountBalance: DEFAULT_ACCOUNT_BALANCE,
      riskPercent: DEFAULT_RISK_PERCENT,
    });
  });

  it("initializes with default account balance and risk percent", () => {
    expect(useAccountSettingsStore.getState().accountBalance).toBe(DEFAULT_ACCOUNT_BALANCE);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(DEFAULT_RISK_PERCENT);
  });

  it("setAccountBalance updates the store and persists to localStorage", () => {
    useAccountSettingsStore.getState().setAccountBalance(5000);
    expect(useAccountSettingsStore.getState().accountBalance).toBe(5000);
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY)!);
    expect(stored.accountBalance).toBe(5000);
  });

  it("setRiskPercent updates the store and persists to localStorage", () => {
    useAccountSettingsStore.getState().setRiskPercent(2.5);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(2.5);
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY)!);
    expect(stored.riskPercent).toBe(2.5);
  });

  it("hydrateAccountSettingsFromStorage loads previously persisted values into the store", () => {
    window.localStorage.setItem(
      ACCOUNT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ accountBalance: 7500, riskPercent: 3 })
    );
    hydrateAccountSettingsFromStorage();
    expect(useAccountSettingsStore.getState().accountBalance).toBe(7500);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(3);
  });

  it("hydrateAccountSettingsFromStorage leaves the store unchanged when nothing is stored", () => {
    hydrateAccountSettingsFromStorage();
    expect(useAccountSettingsStore.getState().accountBalance).toBe(DEFAULT_ACCOUNT_BALANCE);
    expect(useAccountSettingsStore.getState().riskPercent).toBe(DEFAULT_RISK_PERCENT);
  });

  it("loadPersistedAccountSettings returns null for malformed JSON", () => {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, "not valid json");
    expect(loadPersistedAccountSettings()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/analyzer/account-settings-store.test.ts`
Expected: FAIL — cannot find module `./account-settings-store`

- [ ] **Step 3: Implement `lib/analyzer/account-settings-store.ts`**

```ts
import { create } from "zustand";

export const DEFAULT_ACCOUNT_BALANCE = 10000;
export const DEFAULT_RISK_PERCENT = 1;
export const ACCOUNT_SETTINGS_STORAGE_KEY = "trade-analyzer-account-settings";

interface PersistedAccountSettings {
  accountBalance: number;
  riskPercent: number;
}

interface AccountSettingsState extends PersistedAccountSettings {
  setAccountBalance: (value: number) => void;
  setRiskPercent: (value: number) => void;
}

function persistAccountSettings(settings: PersistedAccountSettings): void {
  try {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable (private browsing, disabled) - settings just won't persist
  }
}

export const useAccountSettingsStore = create<AccountSettingsState>((set, get) => ({
  accountBalance: DEFAULT_ACCOUNT_BALANCE,
  riskPercent: DEFAULT_RISK_PERCENT,
  setAccountBalance: (value) => {
    set({ accountBalance: value });
    persistAccountSettings({ accountBalance: value, riskPercent: get().riskPercent });
  },
  setRiskPercent: (value) => {
    set({ riskPercent: value });
    persistAccountSettings({ accountBalance: get().accountBalance, riskPercent: value });
  },
}));

export function loadPersistedAccountSettings(): PersistedAccountSettings | null {
  try {
    const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.accountBalance === "number" && typeof parsed.riskPercent === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function hydrateAccountSettingsFromStorage(): void {
  const loaded = loadPersistedAccountSettings();
  if (loaded) {
    useAccountSettingsStore.setState(loaded);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/analyzer/account-settings-store.test.ts`
Expected: PASS (6 tests). Vitest's `jsdom` environment (already configured for this project) provides a working `window.localStorage`, so no mocking is needed.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/analyzer/account-settings-store.ts lib/analyzer/account-settings-store.test.ts
git commit -m "feat: add persisted account settings store"
```

---

### Task 4: Swing point detection

A small, generically useful helper: given an array of prices, find the "swing highs" (local maxima) and "swing lows" (local minima) using a fixed lookback/lookahead window on each side — the standard technique traders call fractals. This is the building block Task 5's live Head & Shoulders evaluator needs, since real market data can't be recognized by the phase-index tricks Phase 2's synthetic generator used.

**Files:**
- Create: `lib/analyzer/swing-points.ts`, `lib/analyzer/swing-points.test.ts`

- [ ] **Step 1: Write failing tests — `lib/analyzer/swing-points.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { findSwingHighs, findSwingLows } from "./swing-points";

describe("findSwingHighs", () => {
  it("finds local maxima using the given lookback window on each side", () => {
    const highs = [1, 2, 5, 2, 1, 1, 2, 6, 2, 1];
    expect(findSwingHighs(highs, 2)).toEqual([
      { index: 2, price: 5 },
      { index: 7, price: 6 },
    ]);
  });

  it("returns an empty array when no candle is a local maximum", () => {
    const highs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(findSwingHighs(highs, 2)).toEqual([]);
  });
});

describe("findSwingLows", () => {
  it("finds local minima using the given lookback window on each side", () => {
    const lows = [5, 4, 1, 4, 5, 5, 4, 0, 4, 5];
    expect(findSwingLows(lows, 2)).toEqual([
      { index: 2, price: 1 },
      { index: 7, price: 0 },
    ]);
  });

  it("returns an empty array when no candle is a local minimum", () => {
    const lows = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expect(findSwingLows(lows, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/analyzer/swing-points.test.ts`
Expected: FAIL — cannot find module `./swing-points`

- [ ] **Step 3: Implement `lib/analyzer/swing-points.ts`**

```ts
export interface SwingPoint {
  index: number;
  price: number;
}

export function findSwingHighs(highs: number[], window: number): SwingPoint[] {
  const result: SwingPoint[] = [];
  for (let i = window; i < highs.length - window; i++) {
    const slice = highs.slice(i - window, i + window + 1);
    const maxInWindow = Math.max(...slice);
    if (highs[i] === maxInWindow) {
      result.push({ index: i, price: highs[i] });
    }
  }
  return result;
}

export function findSwingLows(lows: number[], window: number): SwingPoint[] {
  const result: SwingPoint[] = [];
  for (let i = window; i < lows.length - window; i++) {
    const slice = lows.slice(i - window, i + window + 1);
    const minInWindow = Math.min(...slice);
    if (lows[i] === minInWindow) {
      result.push({ index: i, price: lows[i] });
    }
  }
  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/analyzer/swing-points.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/analyzer/swing-points.ts lib/analyzer/swing-points.test.ts
git commit -m "feat: add swing high/low (fractal) detection"
```

---

### Task 5: Live Head & Shoulders pattern evaluation

The hardest single piece of logic in this plan. Five of the six strategies reduce to a single-indicator comparison at "the latest candle," which generalizes trivially from Phase 2's synthetic data to live data. Head & Shoulders does not — Phase 2's synthetic version "knows" where its neckline is because it built the candles in explicit phases. For live data, this task finds the three most recent swing highs (via Task 4's `findSwingHighs`), checks whether they form a valid head-and-shoulders shape (middle peak tallest, outer two comparable in height), derives the neckline from the swing lows between them, and only then reuses `detectHeadAndShoulders` (from Task 1) to check whether the latest close has broken below it.

**Files:**
- Create: `lib/analyzer/head-and-shoulders-live.ts`, `lib/analyzer/head-and-shoulders-live.test.ts`

- [ ] **Step 1: Write failing tests — `lib/analyzer/head-and-shoulders-live.test.ts`**

These tests reuse `generateWalk` (Phase 2's seeded generator) rather than hand-authoring candle arrays, since hand-crafting a numerically precise three-peak fixture is error-prone and this codebase already has a proven way to generate one. The first fixture's exact `seed`/`driftAt`/`volatilityAt` values are copied verbatim from `lib/strategies/data.ts`'s `buildHeadAndShoulders` — Phase 2 already empirically proved this exact combination produces a clean, symmetric three-peak shape with a confirmed breakdown (see that file's comment).

```ts
import { describe, it, expect } from "vitest";
import { generateWalk } from "@/lib/strategies/rng";
import { evaluateHeadAndShouldersLive } from "./head-and-shoulders-live";

describe("evaluateHeadAndShouldersLive", () => {
  it("detects alignment once a real three-peak pattern has broken below its neckline", () => {
    const phaseLength = 10;
    const driftAt = (i: number) => {
      const phase = Math.floor(i / phaseLength);
      switch (phase) {
        case 0:
          return 0.5;
        case 1:
          return -0.3;
        case 2:
          return 0.6;
        case 3:
          return -0.6;
        case 4:
          return 0.3;
        default:
          return -0.8;
      }
    };
    // Same seed/drift as lib/strategies/data.ts's buildHeadAndShoulders, which already
    // proved this produces a valid pattern with a confirmed breakdown by candle 63.
    const candles = generateWalk({ seed: 21, count: 70, startPrice: 100, driftAt, volatilityAt: () => 0.6 });

    const result = evaluateHeadAndShouldersLive(candles.slice(0, 63).map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(true);
  });

  it("does not report alignment when price is only trending steadily upward (no head-and-shoulders shape)", () => {
    const candles = generateWalk({
      seed: 99,
      count: 60,
      startPrice: 100,
      driftAt: () => 0.3,
      volatilityAt: () => 0.5,
    });

    const result = evaluateHeadAndShouldersLive(candles.map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(false);
  });

  it("does not report alignment when fewer than three swing highs exist yet", () => {
    const candles = generateWalk({ seed: 1, count: 10, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 0.3 });
    const result = evaluateHeadAndShouldersLive(candles.map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/analyzer/head-and-shoulders-live.test.ts`
Expected: FAIL — cannot find module `./head-and-shoulders-live`

- [ ] **Step 3: Implement `lib/analyzer/head-and-shoulders-live.ts`**

```ts
import { findSwingHighs, findSwingLows } from "./swing-points";
import { detectHeadAndShoulders, type DetectionResult } from "@/lib/strategies/detectors";

const SWING_WINDOW = 3;
const SHOULDER_TOLERANCE_PERCENT = 3;

export function evaluateHeadAndShouldersLive(
  candles: { high: number; low: number; close: number }[]
): DetectionResult {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const swingHighs = findSwingHighs(highs, SWING_WINDOW);
  if (swingHighs.length < 3) {
    return { aligned: false, reason: "no clear three-peak pattern in the recent price action yet" };
  }

  const [leftShoulder, head, rightShoulder] = swingHighs.slice(-3);

  const isHeadTallest = head.price > leftShoulder.price && head.price > rightShoulder.price;
  const shoulderDiffPercent = (Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price) * 100;
  const shouldersComparable = shoulderDiffPercent <= SHOULDER_TOLERANCE_PERCENT;

  if (!isHeadTallest || !shouldersComparable) {
    return { aligned: false, reason: "recent swing highs don't form a valid head-and-shoulders shape" };
  }

  const swingLows = findSwingLows(lows, SWING_WINDOW);
  const troughsBetween = swingLows.filter((low) => low.index > leftShoulder.index && low.index < rightShoulder.index);
  if (troughsBetween.length < 2) {
    return { aligned: false, reason: "no clear neckline (two troughs) found between the shoulders yet" };
  }

  const necklinePrice = Math.min(...troughsBetween.map((t) => t.price));
  const latestClose = candles[candles.length - 1].close;

  return detectHeadAndShoulders(latestClose, necklinePrice);
}
```

- [ ] **Step 4: Run to verify it passes, and empirically verify the pattern-shape logic**

Run: `npx vitest run lib/analyzer/head-and-shoulders-live.test.ts`
Expected: PASS (3 tests)

**If the first test fails**, the swing-detection window (`SWING_WINDOW`) or shoulder tolerance (`SHOULDER_TOLERANCE_PERCENT`) doesn't line up with the specific candle shape this seed/drift combination produces — this is expected to need at most small tuning, similar to Phase 2's Task 4. Debug by temporarily logging `findSwingHighs(candles.map(c => c.high), SWING_WINDOW)` for the first fixture and inspecting whether the three most recent swing highs actually correspond to the left shoulder/head/right shoulder visually (compare against `lib/strategies/data.ts`'s own comment: left shoulder ~105.7, head ~108.3, right shoulder ~105.7, from Phase 2's already-verified numbers). Adjust `SWING_WINDOW` (try 2-5) or `SHOULDER_TOLERANCE_PERCENT` (try 2-5) — do NOT change the seed/drift values, which are already proven correct for the underlying shape. Remove any temporary logging before committing.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/analyzer/head-and-shoulders-live.ts lib/analyzer/head-and-shoulders-live.test.ts
git commit -m "feat: add live head-and-shoulders pattern evaluation via swing points"
```

---

### Task 6: Live strategy alignment check

Wires everything together: given a candle series, `computeStrategyAlignments` computes every indicator each detector needs and runs all six detectors against the latest candle, returning one `StrategyAlignment` per strategy in `STRATEGIES` order (metadata — name/category/entryType — comes directly from `STRATEGIES`, not duplicated). A strategy whose `entryType` doesn't match the trade's direction is marked `"not-applicable"` rather than evaluated. `useLiveStrategyCheck` is the thin React hook wrapper that fetches real candles via `fetchKlines` and feeds them through `computeStrategyAlignments` — it is intentionally not unit-tested here (mocking fetches for a one-line wrapper adds little value); it's exercised through Task 9's component test instead, matching how Phase 1's data-fetching hooks are tested through the panels that use them.

**Files:**
- Create: `lib/analyzer/live-strategy-check.ts`, `lib/analyzer/live-strategy-check.test.ts`

- [ ] **Step 1: Write failing tests — `lib/analyzer/live-strategy-check.test.ts`**

The moving-average-crossover fixture's `seed`/`driftAt` values and slice length are copied verbatim from `lib/strategies/data.ts`'s `buildMovingAverageCrossover`, which already proved this exact combination produces a crossover at index 22 — slicing to length 23 makes that crossover the *latest* candle, which is what `computeStrategyAlignments` checks.

```ts
import { describe, it, expect } from "vitest";
import { generateWalk } from "@/lib/strategies/rng";
import { STRATEGIES } from "@/lib/strategies/data";
import { computeStrategyAlignments } from "./live-strategy-check";

describe("computeStrategyAlignments", () => {
  it("returns one result per strategy in STRATEGIES, in the same order", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "long");
    expect(results.map((r) => r.strategyId)).toEqual(STRATEGIES.map((s) => s.id));
  });

  it("marks the short-only Head & Shoulders strategy as not-applicable for a long trade direction", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "long");
    const hs = results.find((r) => r.strategyId === "head-and-shoulders-reversal")!;
    expect(hs.status).toBe("not-applicable");
  });

  it("marks the five long-only strategies as not-applicable for a short trade direction", () => {
    const candles = generateWalk({ seed: 1, count: 100, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    const results = computeStrategyAlignments(candles, "short");
    const longOnlyIds = [
      "moving-average-crossover",
      "rsi-mean-reversion",
      "support-resistance-breakout",
      "bollinger-band-squeeze",
      "macd-momentum-cross",
    ];
    for (const id of longOnlyIds) {
      expect(results.find((r) => r.strategyId === id)!.status).toBe("not-applicable");
    }
  });

  it("evaluates the moving average crossover as aligned when a real crossover just happened at the latest candle", () => {
    const candles = generateWalk({
      seed: 1,
      count: 60,
      startPrice: 100,
      driftAt: (i) => (i < 20 ? -0.05 : 0.35),
      volatilityAt: () => 1,
    }).slice(0, 23);
    const results = computeStrategyAlignments(candles, "long");
    const ma = results.find((r) => r.strategyId === "moving-average-crossover")!;
    expect(ma.status).toBe("aligned");
  });

  it("evaluates the moving average crossover as not-yet before any crossover has happened", () => {
    const candles = generateWalk({
      seed: 1,
      count: 60,
      startPrice: 100,
      driftAt: (i) => (i < 20 ? -0.05 : 0.35),
      volatilityAt: () => 1,
    }).slice(0, 20);
    const results = computeStrategyAlignments(candles, "long");
    const ma = results.find((r) => r.strategyId === "moving-average-crossover")!;
    expect(ma.status).toBe("not-yet");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/analyzer/live-strategy-check.test.ts`
Expected: FAIL — cannot find module `./live-strategy-check`

- [ ] **Step 3: Implement `lib/analyzer/live-strategy-check.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/analyzer/live-strategy-check.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `fetchKlines`'s second parameter is typed `BinanceInterval` (a literal union) — `KLINE_INTERVAL` is declared `"1h" as const` specifically so it satisfies that type rather than widening to `string`.

- [ ] **Step 6: Commit**

```bash
git add lib/analyzer/live-strategy-check.ts lib/analyzer/live-strategy-check.test.ts
git commit -m "feat: add live strategy alignment check against real market data"
```

---

### Task 7: Trade input form

A controlled, presentational form: symbol picker, entry/take-profit/stop-loss fields, and account balance/risk-percent fields. No internal state — the parent (Task 10's page) owns all values and passes them down, matching a standard controlled-component pattern. Entry/TP/SL are kept as strings (not numbers) in the form's value type so a field can be legitimately empty or mid-edit (e.g. just "1" while typing "100") without forcing an awkward `NaN`.

**Files:**
- Create: `components/analyzer/trade-input-form.tsx`, `components/analyzer/trade-input-form.test.tsx`

- [ ] **Step 1: Write failing tests — `components/analyzer/trade-input-form.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeInputForm, type TradeFormValues } from "./trade-input-form";

const baseValues: TradeFormValues = {
  symbol: "BTCUSDT",
  entryPrice: "100",
  takeProfitPrice: "110",
  stopLossPrice: "95",
};

describe("TradeInputForm", () => {
  it("renders the current values and calls onChange when the entry price is edited", () => {
    const onChange = vi.fn();
    render(
      <TradeInputForm
        values={baseValues}
        onChange={onChange}
        accountBalance={10000}
        onAccountBalanceChange={vi.fn()}
        riskPercent={1}
        onRiskPercentChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "105" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseValues, entryPrice: "105" });
  });

  it("calls onAccountBalanceChange and onRiskPercentChange when those fields are edited", () => {
    const onAccountBalanceChange = vi.fn();
    const onRiskPercentChange = vi.fn();
    render(
      <TradeInputForm
        values={baseValues}
        onChange={vi.fn()}
        accountBalance={10000}
        onAccountBalanceChange={onAccountBalanceChange}
        riskPercent={1}
        onRiskPercentChange={onRiskPercentChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Account Balance ($)"), { target: { value: "20000" } });
    expect(onAccountBalanceChange).toHaveBeenCalledWith(20000);

    fireEvent.change(screen.getByLabelText("Risk Per Trade (%)"), { target: { value: "2" } });
    expect(onRiskPercentChange).toHaveBeenCalledWith(2);
  });

  it("lists every curated symbol as an option", () => {
    render(
      <TradeInputForm
        values={baseValues}
        onChange={vi.fn()}
        accountBalance={10000}
        onAccountBalanceChange={vi.fn()}
        riskPercent={1}
        onRiskPercentChange={vi.fn()}
      />
    );
    expect(screen.getByRole("option", { name: "Bitcoin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ethereum" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/analyzer/trade-input-form.test.tsx`
Expected: FAIL — cannot find module `./trade-input-form`

- [ ] **Step 3: Implement `components/analyzer/trade-input-form.tsx`**

```tsx
"use client";

import { CURATED_SYMBOLS } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface TradeFormValues {
  symbol: string;
  entryPrice: string;
  takeProfitPrice: string;
  stopLossPrice: string;
}

export interface TradeInputFormProps {
  values: TradeFormValues;
  onChange: (values: TradeFormValues) => void;
  accountBalance: number;
  onAccountBalanceChange: (value: number) => void;
  riskPercent: number;
  onRiskPercentChange: (value: number) => void;
}

const FIELD_CLASS = "rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none";

export function TradeInputForm({
  values,
  onChange,
  accountBalance,
  onAccountBalanceChange,
  riskPercent,
  onRiskPercentChange,
}: TradeInputFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Setup</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <select
            value={values.symbol}
            onChange={(e) => onChange({ ...values, symbol: e.target.value })}
            className={FIELD_CLASS}
          >
            {CURATED_SYMBOLS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Entry Price
          <input
            type="number"
            value={values.entryPrice}
            onChange={(e) => onChange({ ...values, entryPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Take Profit
          <input
            type="number"
            value={values.takeProfitPrice}
            onChange={(e) => onChange({ ...values, takeProfitPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Stop Loss
          <input
            type="number"
            value={values.stopLossPrice}
            onChange={(e) => onChange({ ...values, stopLossPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Account Balance ($)
          <input
            type="number"
            value={accountBalance}
            onChange={(e) => onAccountBalanceChange(Number(e.target.value))}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Risk Per Trade (%)
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => onRiskPercentChange(Number(e.target.value))}
            className={FIELD_CLASS}
          />
        </label>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/analyzer/trade-input-form.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/analyzer/trade-input-form.tsx components/analyzer/trade-input-form.test.tsx
git commit -m "feat: add trade input form"
```

---

### Task 8: Trade summary panel

Renders the calculated risk:reward, position size, and max loss/gain for the current trade inputs, plus the live current price for context (fetched independently — this panel owns its own query, matching the established pattern in `components/markets/stat-panels/sentiment-panel.tsx`). Shows a validation message instead of numbers when the inputs are incomplete or contradictory.

**Note on a lesson from Phase 1:** the "Current Price" row renders its loading `Skeleton` (a `<div>`) as a sibling of the label `<span>`, never nested inside another inline element — Phase 1 found and fixed exactly this class of invalid-HTML-nesting bug (a `<div>`-based `Skeleton` nested inside a `<p>`) in two separate components, so this task avoids it from the start rather than repeating it.

**Files:**
- Create: `components/analyzer/trade-summary-panel.tsx`, `components/analyzer/trade-summary-panel.test.tsx`

- [ ] **Step 1: Write failing tests — `components/analyzer/trade-summary-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";

vi.mock("@/lib/binance/rest", () => ({
  fetchTicker24hr: vi.fn(),
}));

import { fetchTicker24hr } from "@/lib/binance/rest";
import { TradeSummaryPanel } from "./trade-summary-panel";

describe("TradeSummaryPanel", () => {
  it("prompts for input when entry/TP/SL are incomplete", () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={null}
        takeProfitPrice={110}
        stopLossPrice={95}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText(/enter an entry price/i)).toBeInTheDocument();
  });

  it("shows a validation message for a contradictory trade setup", () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={100}
        takeProfitPrice={110}
        stopLossPrice={105}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText(/isn't a valid trade setup/i)).toBeInTheDocument();
  });

  it("computes and displays direction, risk:reward, and position size for a valid long trade", async () => {
    vi.mocked(fetchTicker24hr).mockResolvedValue([]);
    renderWithQueryClient(
      <TradeSummaryPanel
        symbol="BTCUSDT"
        entryPrice={100}
        takeProfitPrice={110}
        stopLossPrice={95}
        accountBalance={10000}
        riskPercent={1}
      />
    );
    expect(screen.getByText("long")).toBeInTheDocument();
    expect(screen.getByText("1:2.00")).toBeInTheDocument();
    expect(await screen.findByText(/20\.0000 units/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/analyzer/trade-summary-panel.test.tsx`
Expected: FAIL — cannot find module `./trade-summary-panel`

- [ ] **Step 3: Implement `components/analyzer/trade-summary-panel.tsx`**

```tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "@/components/markets/stale-badge";
import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { formatPrice, formatPercent } from "@/lib/format";
import { inferDirection, computeRiskReward, computePositionSize, computeMaxLossGain } from "@/lib/analyzer/calculations";

export interface TradeSummaryPanelProps {
  symbol: string;
  entryPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  accountBalance: number;
  riskPercent: number;
}

export function TradeSummaryPanel({
  symbol,
  entryPrice,
  takeProfitPrice,
  stopLossPrice,
  accountBalance,
  riskPercent,
}: TradeSummaryPanelProps) {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", symbol],
    queryFn: () => fetchTicker24hr([symbol]),
    refetchInterval: 30_000,
  });
  const currentPrice = data?.[0]?.lastPrice;

  const hasAllInputs = entryPrice !== null && takeProfitPrice !== null && stopLossPrice !== null;
  const direction = hasAllInputs ? inferDirection(entryPrice, takeProfitPrice, stopLossPrice) : "invalid";

  let riskReward: number | null = null;
  let positionSize: ReturnType<typeof computePositionSize> | null = null;
  let maxLossGain: ReturnType<typeof computeMaxLossGain> | null = null;
  let currentPriceDiffPercent: number | undefined;

  if (hasAllInputs && direction !== "invalid") {
    riskReward = computeRiskReward(entryPrice, takeProfitPrice, stopLossPrice, direction);
    positionSize = computePositionSize(accountBalance, riskPercent, entryPrice, stopLossPrice);
    maxLossGain = computeMaxLossGain(
      positionSize.units,
      accountBalance,
      entryPrice,
      takeProfitPrice,
      stopLossPrice,
      direction
    );
    if (currentPrice !== undefined) {
      currentPriceDiffPercent = ((entryPrice - currentPrice) / currentPrice) * 100;
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trade Summary</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!hasAllInputs ? (
          <p className="text-muted-foreground">Enter an entry price, take-profit, and stop-loss to see the analysis.</p>
        ) : direction === "invalid" ? (
          <p className="text-down">
            This isn&apos;t a valid trade setup — take-profit and stop-loss must be on opposite sides of the entry price
            {stopLossPrice === entryPrice ? " (stop-loss cannot equal entry price)" : ""}.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Direction</span>
              <span className="font-medium capitalize">{direction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Risk:Reward</span>
              <span className="font-medium">1:{riskReward!.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-medium">
                {positionSize!.units.toFixed(4)} units (${formatPrice(positionSize!.notionalValue)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max Loss</span>
              <span className="font-medium text-down">
                ${formatPrice(maxLossGain!.maxLossAmount)} ({formatPercent(-maxLossGain!.maxLossPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max Gain</span>
              <span className="font-medium text-up">
                ${formatPrice(maxLossGain!.maxGainAmount)} ({formatPercent(maxLossGain!.maxGainPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Price</span>
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="font-medium">
                  {currentPrice === undefined
                    ? "—"
                    : `$${formatPrice(currentPrice)} (entry is ${formatPercent(currentPriceDiffPercent!)} away)`}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/analyzer/trade-summary-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/analyzer/trade-summary-panel.tsx components/analyzer/trade-summary-panel.test.tsx
git commit -m "feat: add trade summary panel"
```

---

### Task 9: Strategy alignment panel

Renders the six-strategy live checklist by calling Task 6's `useLiveStrategyCheck` hook directly (self-contained, matching the established "each panel owns its own query" pattern). Shows a neutral prompt when the trade direction is `"invalid"` (nothing to check yet), a skeleton while loading, and otherwise one row per strategy with a status `Badge` and its reason text.

**Files:**
- Create: `components/analyzer/strategy-alignment-panel.tsx`, `components/analyzer/strategy-alignment-panel.test.tsx`

- [ ] **Step 1: Write failing tests — `components/analyzer/strategy-alignment-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";

vi.mock("@/lib/binance/rest", () => ({
  fetchKlines: vi.fn(),
}));

import { fetchKlines } from "@/lib/binance/rest";
import { StrategyAlignmentPanel } from "./strategy-alignment-panel";

function candle(i: number, close: number) {
  return { openTime: i, open: close, high: close + 1, low: close - 1, close, volume: 100, closeTime: i };
}

describe("StrategyAlignmentPanel", () => {
  it("prompts for a valid trade setup when direction is invalid", () => {
    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="invalid" />);
    expect(screen.getByText(/enter a valid trade setup/i)).toBeInTheDocument();
  });

  it("renders one row per strategy once live data resolves", async () => {
    const candles = Array.from({ length: 100 }, (_, i) => candle(i, 100 + i * 0.1));
    vi.mocked(fetchKlines).mockResolvedValue(candles);

    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="long" />);

    expect(await screen.findByText("Moving Average Crossover")).toBeInTheDocument();
    expect(screen.getByText("RSI Mean Reversion")).toBeInTheDocument();
    expect(screen.getByText("Support/Resistance Breakout")).toBeInTheDocument();
    expect(screen.getByText("Bollinger Band Squeeze")).toBeInTheDocument();
    expect(screen.getByText("MACD Momentum Cross")).toBeInTheDocument();
    expect(screen.getByText("Head & Shoulders Reversal")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("shows a data-unavailable message when the live fetch fails", async () => {
    vi.mocked(fetchKlines).mockRejectedValue(new Error("network error"));
    renderWithQueryClient(<StrategyAlignmentPanel symbol="BTCUSDT" direction="long" />);
    expect(await screen.findByText(/live strategy data unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/analyzer/strategy-alignment-panel.test.tsx`
Expected: FAIL — cannot find module `./strategy-alignment-panel`

- [ ] **Step 3: Implement `components/analyzer/strategy-alignment-panel.tsx`**

```tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "@/components/markets/stale-badge";
import { useLiveStrategyCheck, type AlignmentStatus } from "@/lib/analyzer/live-strategy-check";
import type { TradeDirection } from "@/lib/analyzer/calculations";

export interface StrategyAlignmentPanelProps {
  symbol: string;
  direction: TradeDirection;
}

const STATUS_LABEL: Record<AlignmentStatus, string> = {
  aligned: "Aligned",
  "not-yet": "Not Yet",
  "not-applicable": "N/A",
};

const STATUS_VARIANT: Record<AlignmentStatus, "up" | "down" | "neutral"> = {
  aligned: "up",
  "not-yet": "neutral",
  "not-applicable": "neutral",
};

export function StrategyAlignmentPanel({ symbol, direction }: StrategyAlignmentPanelProps) {
  const { data, isLoading, isStale } = useLiveStrategyCheck(symbol, direction);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Strategy Alignment</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {direction === "invalid" ? (
          <p className="text-sm text-muted-foreground">Enter a valid trade setup to see live strategy alignment.</p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Live strategy data unavailable for {symbol}.</p>
        ) : (
          data.map((result) => (
            <div
              key={result.strategyId}
              className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{result.name}</span>
                <Badge variant={STATUS_VARIANT[result.status]}>{STATUS_LABEL[result.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{result.reason}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/analyzer/strategy-alignment-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add components/analyzer/strategy-alignment-panel.tsx components/analyzer/strategy-alignment-panel.test.tsx
git commit -m "feat: add strategy alignment panel"
```

---

### Task 10: Analyzer page

Replaces Phase 1's `ComingSoon` placeholder at `/analyzer`. Owns the form state (symbol + entry/TP/SL as strings) and the account-settings store, parses the string inputs to numbers, infers the trade direction once, and passes everything down to Tasks 7-9's components. Calls `hydrateAccountSettingsFromStorage()` once on mount (client-only, post-hydration, per Task 3's design).

**Files:**
- Modify: `app/analyzer/page.tsx` (currently `<ComingSoon title="Analyzer" />` from Phase 1)
- Create: `app/analyzer/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/analyzer/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";

vi.mock("@/components/analyzer/trade-input-form", () => ({
  TradeInputForm: ({
    values,
    onChange,
  }: {
    values: { entryPrice: string };
    onChange: (v: { entryPrice: string }) => void;
  }) => (
    <input aria-label="entry-stub" value={values.entryPrice} onChange={(e) => onChange({ entryPrice: e.target.value })} />
  ),
}));
vi.mock("@/components/analyzer/trade-summary-panel", () => ({
  TradeSummaryPanel: ({ entryPrice }: { entryPrice: number | null }) => (
    <div data-testid="summary-stub">{String(entryPrice)}</div>
  ),
}));
vi.mock("@/components/analyzer/strategy-alignment-panel", () => ({
  StrategyAlignmentPanel: ({ direction }: { direction: string }) => (
    <div data-testid="alignment-stub">{direction}</div>
  ),
}));

import AnalyzerPage from "./page";

describe("AnalyzerPage", () => {
  it("renders the title and both analysis panels, wiring form state through to them", () => {
    renderWithQueryClient(<AnalyzerPage />);

    expect(screen.getByRole("heading", { name: "Trade Analyzer" })).toBeInTheDocument();
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("null");
    expect(screen.getByTestId("alignment-stub")).toHaveTextContent("invalid");

    fireEvent.change(screen.getByLabelText("entry-stub"), { target: { value: "100" } });
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("100");
  });
});
```

Note: the mocked `TradeInputForm` above only forwards `entryPrice` for brevity (enough to prove the page wires state through); it doesn't need to replicate the full `TradeFormValues` shape since the real component is mocked out entirely in this test.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/analyzer/page.test.tsx`
Expected: FAIL — the current `ComingSoon` placeholder doesn't render any of these testids/headings

- [ ] **Step 3: Replace `app/analyzer/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAccountSettingsStore, hydrateAccountSettingsFromStorage } from "@/lib/analyzer/account-settings-store";
import { inferDirection } from "@/lib/analyzer/calculations";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import { TradeInputForm, type TradeFormValues } from "@/components/analyzer/trade-input-form";
import { TradeSummaryPanel } from "@/components/analyzer/trade-summary-panel";
import { StrategyAlignmentPanel } from "@/components/analyzer/strategy-alignment-panel";

function parseNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AnalyzerPage() {
  const [formValues, setFormValues] = useState<TradeFormValues>({
    symbol: DEFAULT_SYMBOL,
    entryPrice: "",
    takeProfitPrice: "",
    stopLossPrice: "",
  });
  const accountBalance = useAccountSettingsStore((s) => s.accountBalance);
  const riskPercent = useAccountSettingsStore((s) => s.riskPercent);
  const setAccountBalance = useAccountSettingsStore((s) => s.setAccountBalance);
  const setRiskPercent = useAccountSettingsStore((s) => s.setRiskPercent);

  useEffect(() => {
    hydrateAccountSettingsFromStorage();
  }, []);

  const entryPrice = parseNumberOrNull(formValues.entryPrice);
  const takeProfitPrice = parseNumberOrNull(formValues.takeProfitPrice);
  const stopLossPrice = parseNumberOrNull(formValues.stopLossPrice);

  const direction =
    entryPrice !== null && takeProfitPrice !== null && stopLossPrice !== null
      ? inferDirection(entryPrice, takeProfitPrice, stopLossPrice)
      : "invalid";

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Trade Analyzer</h1>
        <p className="text-sm text-muted-foreground">
          Enter a proposed trade to see its risk:reward, position size, and how it lines up against live market
          conditions for each strategy in the library.
        </p>
      </div>
      <TradeInputForm
        values={formValues}
        onChange={setFormValues}
        accountBalance={accountBalance}
        onAccountBalanceChange={setAccountBalance}
        riskPercent={riskPercent}
        onRiskPercentChange={setRiskPercent}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TradeSummaryPanel
          symbol={formValues.symbol}
          entryPrice={entryPrice}
          takeProfitPrice={takeProfitPrice}
          stopLossPrice={stopLossPrice}
          accountBalance={accountBalance}
          riskPercent={riskPercent}
        />
        <StrategyAlignmentPanel symbol={formValues.symbol} direction={direction} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/analyzer/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite and production build**

Run: `npx vitest run`
Expected: PASS — every test file from this plan plus everything from Phases 1-2 passes (133 tests from before this plan + this plan's new tests).

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/analyzer/page.tsx app/analyzer/page.test.tsx
git commit -m "feat: compose the trade analyzer page"
```

---

### Task 11: Manual browser verification

Live network calls, real chart/localStorage behavior, and whether the live Head & Shoulders detector produces sane-looking results on real data can't be verified by the test suite. This mirrors Phase 1's Task 25 and Phase 2's Task 8.

**Files:** none (verification only; fix forward in the relevant task's files if something's broken)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running). Before starting, check for and stop any stale process already listening on port 3000 (a prior session in this project found a stale dev server silently causing a second instance to start on port 3001, which produced misleading verification results).

- [ ] **Step 2: Open `/analyzer` and confirm the page renders**

Navigate to `http://localhost:3000/analyzer`. Confirm: the title/intro render, the trade setup form (symbol dropdown, entry/TP/SL fields, account balance/risk fields) renders, and both the Trade Summary and Strategy Alignment cards render (initially showing their "enter a valid trade setup" prompts, since the form starts empty).

- [ ] **Step 3: Enter a valid long trade and check the math**

Pick BTCUSDT (or whatever the default symbol is), enter an entry price near the real current BTC price (check the live price shown in the Trade Summary panel once it loads, then pick a nearby entry), a take-profit above it, and a stop-loss below it. Confirm: Direction shows "long", Risk:Reward matches manual arithmetic (reward distance ÷ risk distance), Position Size and Max Loss/Gain numbers are internally consistent (Max Loss $ should equal accountBalance × riskPercent / 100, e.g. $100 for a $10,000 balance at 1% risk), and the Current Price row shows a real live price with a sensible "away" percentage.

- [ ] **Step 4: Check the live Strategy Alignment panel against reality**

Confirm all 6 strategies render with a status badge and reason text. Confirm the badges are plausible — not all 6 stuck on the same status permanently (which would suggest the live indicator math isn't actually varying with real data), and the reason text for at least 2-3 strategies references real-looking numbers (e.g. an actual RSI value, an actual SMA comparison). For the Head & Shoulders row specifically: since it's short-only, confirm it shows either "N/A" (if the trade you entered was long, as expected) or, if you enter a short trade instead, a genuine Aligned/Not Yet status with a reason.

- [ ] **Step 5: Enter a short trade and re-check direction-based filtering**

Change the take-profit to below the entry price and the stop-loss to above it. Confirm Direction flips to "short", the five long-only strategies (Moving Average Crossover, RSI Mean Reversion, Support/Resistance Breakout, Bollinger Band Squeeze, MACD Momentum Cross) all show "N/A", and Head & Shoulders shows a real Aligned/Not Yet status.

- [ ] **Step 6: Enter a contradictory trade setup and confirm validation**

Set take-profit and stop-loss both above the entry price. Confirm the Trade Summary panel shows the "isn't a valid trade setup" message instead of numbers, and the Strategy Alignment panel shows its "enter a valid trade setup" prompt instead of the checklist.

- [ ] **Step 7: Check account settings persistence**

Change the account balance and risk percent to non-default values. Reload the page. Confirm both fields still show the values you set (not the defaults) — this is the localStorage persistence from Task 3 working correctly, with no hydration-mismatch console error on reload.

- [ ] **Step 8: Check the browser console**

No uncaught errors during page load, form interaction, symbol changes, or the reload in Step 7.

- [ ] **Step 9: Toggle light mode**

Click the theme toggle. Confirm the form, both panels, and all badge colors re-theme correctly with readable contrast.

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

**Spec coverage:** every section of the approved design spec (`docs/superpowers/specs/2026-09-06-trade-analyzer-design.md`) maps to a task — inferred direction and account settings persistence (Tasks 2-3), live price context (Task 8), live strategy alignment via extracted shared detectors (Tasks 1, 5, 6, 9), the one-shot/no-history scope boundary (no task adds any saved trade list), and the page composition replacing the `/analyzer` placeholder (Task 10). The design spec's open question of exact detector signatures and kline interval/count is resolved concretely in Tasks 1 and 6 (plain-number pure functions; `"1h"`/100 candles).

**Placeholder scan:** no TBD/TODO markers. Task 5's swing-window/tolerance constants are flagged as needing possible empirical tuning (mirroring Phase 2 Task 4's precedent), with a concrete debugging procedure given, not left vague.

**Type consistency:** `DetectionResult` (Task 1) is the return type of all six `detect*()` functions and is reused unchanged by `evaluateHeadAndShouldersLive` (Task 5) and `computeStrategyAlignments` (Task 6). `TradeDirection` (Task 2) is used identically by `TradeSummaryPanel` (Task 8, computed internally) and `StrategyAlignmentPanel`/`AnalyzerPage` (Tasks 9-10, passed as a prop). `StrategyAlignment`/`AlignmentStatus` (Task 6) are consumed unchanged by `StrategyAlignmentPanel` (Task 9). `TradeFormValues` (Task 7) is the exact shape both `AnalyzerPage` (Task 10) and its own test use. `ACCOUNT_SETTINGS_STORAGE_KEY`/`DEFAULT_ACCOUNT_BALANCE`/`DEFAULT_RISK_PERCENT` (Task 3) are the single source of truth wherever those values are needed.
