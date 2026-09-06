# Strategies Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/strategies` placeholder with a real page teaching six common trading strategies, each with a plain-language explanation and a looping animated chart demo showing entry/take-profit/stop-loss on a synthetic (non-live) price series shaped to actually exhibit that strategy's setup.

**Architecture:** Purely static and client-side — no live data, no network calls, no user state. A seeded deterministic candle generator produces reproducible synthetic OHLC series shaped per strategy (gentle uptrend, consolidation-then-breakout, volatility squeeze, three-peak reversal, etc.); small technical-indicator helpers (SMA/EMA/RSI/rolling stdev) then locate each strategy's actual entry signal within its generated series, so entry/TP/SL are derived from the data rather than hand-picked. A `StrategyDemoChart` component reuses Phase 1's `lightweight-charts` dependency to animate the reveal.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS (all from Phase 1), `lightweight-charts` (already a Phase 1 dependency — no new packages needed), Vitest, @testing-library/react.

---

## File Structure

```
lib/strategies/
  rng.ts                     - seeded deterministic PRNG (mulberry32) + generateWalk()
  indicators.ts              - sma(), ema(), rsi(), rollingStdev() — small array-in/array-out helpers
  trade.ts                   - computeTrade() — derives entry/TP/SL/exit from a candle series + entry index
  data.ts                    - STRATEGIES: Strategy[] — the 6 curated strategies, built from rng.ts + indicators.ts + trade.ts
components/strategies/
  strategy-demo-chart.tsx    - animated lightweight-charts wrapper (candle-by-candle reveal + entry/TP/SL markers, looping)
  strategy-card.tsx          - Card wrapper: name, category Badge, description, embeds StrategyDemoChart
app/strategies/
  page.tsx                   - replaces Task 11's ComingSoon placeholder; groups STRATEGIES by category, renders StrategyCard grid
```

Each file has a colocated `*.test.ts`/`*.test.tsx`.

---

### Task 1: Seeded candle generator

**Files:**
- Create: `lib/strategies/rng.ts`, `lib/strategies/rng.test.ts`

- [ ] **Step 1: Write failing tests — `lib/strategies/rng.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mulberry32, generateWalk } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sequenceA = [a(), a(), a()];
    const sequenceB = [b(), b(), b()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
});

describe("generateWalk", () => {
  it("is deterministic for a given seed", () => {
    const optionsA = { seed: 7, count: 20, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 };
    const a = generateWalk(optionsA);
    const b = generateWalk({ ...optionsA });
    expect(a).toEqual(b);
  });

  it("produces the requested number of candles with sequential, evenly-spaced times", () => {
    const candles = generateWalk({ seed: 1, count: 10, startPrice: 100, driftAt: () => 0, volatilityAt: () => 1 });
    expect(candles).toHaveLength(10);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time - candles[i - 1].time).toBe(86400);
    }
  });

  it("keeps every candle's OHLC internally consistent (low <= open,close <= high)", () => {
    const candles = generateWalk({ seed: 3, count: 50, startPrice: 100, driftAt: () => 0.2, volatilityAt: () => 2 });
    for (const c of candles) {
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(c.high);
    }
  });

  it("keeps prices positive even under strong negative drift", () => {
    const candles = generateWalk({ seed: 9, count: 30, startPrice: 5, driftAt: () => -10, volatilityAt: () => 1 });
    for (const c of candles) {
      expect(c.open).toBeGreaterThan(0);
      expect(c.close).toBeGreaterThan(0);
      expect(c.low).toBeGreaterThan(0);
    }
  });

  it("chains each candle's open to the previous candle's close", () => {
    const candles = generateWalk({ seed: 5, count: 15, startPrice: 100, driftAt: () => 0.1, volatilityAt: () => 1 });
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].open).toBe(candles[i - 1].close);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/strategies/rng.test.ts`
Expected: FAIL — cannot find module `./rng`

- [ ] **Step 3: Implement `lib/strategies/rng.ts`**

```ts
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface GenerateWalkOptions {
  seed: number;
  count: number;
  startPrice: number;
  /** Expected price change for the candle at index i, before noise. */
  driftAt: (i: number) => number;
  /** Magnitude of random noise added around the drift at index i. */
  volatilityAt: (i: number) => number;
}

const SECONDS_PER_DAY = 86400;
const BASE_TIME = 1735689600; // 2025-01-01T00:00:00Z, arbitrary fixed anchor

export function generateWalk(options: GenerateWalkOptions): GeneratedCandle[] {
  const { seed, count, startPrice, driftAt, volatilityAt } = options;
  const rng = mulberry32(seed);
  const candles: GeneratedCandle[] = [];
  let open = startPrice;

  for (let i = 0; i < count; i++) {
    const volatility = Math.max(0, volatilityAt(i));
    const change = driftAt(i) + (rng() - 0.5) * volatility;
    const close = Math.max(0.01, open + change);
    const wickUp = rng() * volatility * 0.3;
    const wickDown = rng() * volatility * 0.3;
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(0.01, Math.min(open, close) - wickDown);

    candles.push({ time: BASE_TIME + i * SECONDS_PER_DAY, open, high, low, close });
    open = close;
  }

  return candles;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/strategies/rng.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/strategies/rng.ts lib/strategies/rng.test.ts
git commit -m "feat: add seeded deterministic candle generator"
```

---

### Task 2: Technical indicator helpers

**Files:**
- Create: `lib/strategies/indicators.ts`, `lib/strategies/indicators.test.ts`

- [ ] **Step 1: Write failing tests — `lib/strategies/indicators.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { sma, ema, rsi, rollingStdev } from "./indicators";

describe("sma", () => {
  it("computes a trailing simple moving average, undefined before the window fills", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([undefined, undefined, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("weights recent values more heavily than a simple average would", () => {
    // period=3, k=0.5. Seed at index2 = avg(10,10,10) = 10.
    // index3: 20*0.5 + 10*0.5 = 15 (an SMA here would give (10+10+20)/3 = 13.33 -- different, proving EMA weighting).
    // index4: 10*0.5 + 15*0.5 = 12.5
    // index5: 10*0.5 + 12.5*0.5 = 11.25
    // index6: 10*0.5 + 11.25*0.5 = 10.625
    const result = ema([10, 10, 10, 20, 10, 10, 10], 3);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(10);
    expect(result[3]).toBe(15);
    expect(result[4]).toBe(12.5);
    expect(result[5]).toBe(11.25);
    expect(result[6]).toBe(10.625);
  });
});

describe("rsi", () => {
  it("returns 50 when average gains and losses over the period are equal", () => {
    // Alternating +1/-1 changes: 7 gains of 1, 7 losses of 1 over the 14-period window.
    const values = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
    const result = rsi(values, 14);
    expect(result[14]).toBe(50);
  });

  it("returns undefined before the window fills", () => {
    const result = rsi([1, 2, 3], 14);
    expect(result.every((v) => v === undefined)).toBe(true);
  });
});

describe("rollingStdev", () => {
  it("computes the population standard deviation over a trailing window", () => {
    expect(rollingStdev([1, 3], 2)).toEqual([undefined, 1]);
  });

  it("returns undefined before the window fills", () => {
    expect(rollingStdev([1, 2], 3)).toEqual([undefined, undefined]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/strategies/indicators.test.ts`
Expected: FAIL — cannot find module `./indicators`

- [ ] **Step 3: Implement `lib/strategies/indicators.ts`**

```ts
export function sma(values: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    result.push(i >= period - 1 ? sum / period : undefined);
  }
  return result;
}

export function ema(values: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  const k = 2 / (period + 1);
  let previous: number | undefined;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += values[j];
      previous = sum / period;
      result.push(previous);
      continue;
    }
    previous = values[i] * k + (previous as number) * (1 - k);
    result.push(previous);
  }

  return result;
}

export function rsi(values: number[], period = 14): (number | undefined)[] {
  const result: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

export function rollingStdev(values: number[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    result.push(Math.sqrt(variance));
  }
  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/strategies/indicators.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/strategies/indicators.ts lib/strategies/indicators.test.ts
git commit -m "feat: add SMA/EMA/RSI/rolling-stdev indicator helpers"
```

---

### Task 3: Trade computation (entry → stop-loss/take-profit → exit)

**Files:**
- Create: `lib/strategies/trade.ts`, `lib/strategies/trade.test.ts`

- [ ] **Step 1: Write failing tests — `lib/strategies/trade.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeTrade } from "./trade";
import type { GeneratedCandle } from "./rng";

describe("computeTrade", () => {
  it("sets a long trade's stop below the recent swing low and target at 2x that risk, exiting at take-profit if hit first", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 98, close: 100 },
      { time: 1, open: 100, high: 102, low: 99, close: 101 },
      { time: 2, open: 101, high: 103, low: 100, close: 102 }, // entry
      { time: 3, open: 102, high: 104, low: 101, close: 103 },
      { time: 4, open: 103, high: 200, low: 102, close: 110 }, // high spikes through take-profit
    ];
    // Swing low over indices 0-2 is 98. Entry (close at index 2) is 102. Risk = 102-98 = 4.
    // Stop-loss = 98. Take-profit = 102 + 4*2 = 110.
    const result = computeTrade(candles, 2, "long");
    expect(result.entryPrice).toBe(102);
    expect(result.stopLossPrice).toBe(98);
    expect(result.takeProfitPrice).toBe(110);
    expect(result.exitIndex).toBe(4);
    expect(result.exitReason).toBe("take-profit");
  });

  it("exits at stop-loss when price breaches it before reaching take-profit", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 98, close: 100 },
      { time: 1, open: 100, high: 102, low: 99, close: 101 },
      { time: 2, open: 101, high: 103, low: 100, close: 102 }, // entry: stop-loss=98, take-profit=110
      { time: 3, open: 102, high: 103, low: 97, close: 98 }, // low breaches 98
      { time: 4, open: 98, high: 200, low: 97, close: 110 },
    ];
    const result = computeTrade(candles, 2, "long");
    expect(result.exitIndex).toBe(3);
    expect(result.exitReason).toBe("stop-loss");
  });

  it("mirrors stop/target above the recent swing high for a short trade", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 104, low: 99, close: 100 },
      { time: 1, open: 100, high: 103, low: 98, close: 99 },
      { time: 2, open: 99, high: 101, low: 97, close: 98 }, // entry
      { time: 3, open: 98, high: 99, low: 96, close: 97 },
      { time: 4, open: 97, high: 98, low: 80, close: 82 }, // low drops through take-profit
    ];
    // Swing high over indices 0-2 is 104. Entry (close at index 2) is 98. Risk = 104-98 = 6.
    // Stop-loss = 104. Take-profit = 98 - 6*2 = 86.
    const result = computeTrade(candles, 2, "short");
    expect(result.entryPrice).toBe(98);
    expect(result.stopLossPrice).toBe(104);
    expect(result.takeProfitPrice).toBe(86);
    expect(result.exitIndex).toBe(4);
    expect(result.exitReason).toBe("take-profit");
  });

  it("reports end-of-data when neither level is reached before the series ends", () => {
    const candles: GeneratedCandle[] = [
      { time: 0, open: 100, high: 101, low: 99, close: 100 },
      { time: 1, open: 100, high: 101, low: 99, close: 100 },
      { time: 2, open: 100, high: 101, low: 99, close: 100 }, // entry: stop-loss=99, take-profit=102
      { time: 3, open: 100, high: 100.5, low: 99.5, close: 100 }, // stays inside both levels
    ];
    const result = computeTrade(candles, 2, "long");
    expect(result.exitIndex).toBe(3);
    expect(result.exitReason).toBe("end-of-data");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/strategies/trade.test.ts`
Expected: FAIL — cannot find module `./trade`

- [ ] **Step 3: Implement `lib/strategies/trade.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/strategies/trade.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/strategies/trade.ts lib/strategies/trade.test.ts
git commit -m "feat: add trade outcome computation (stop-loss/take-profit/exit)"
```

---

### Task 4: The six curated strategies

This is the largest task in this plan. Each strategy is built the same way: generate a synthetic candle series shaped to exhibit that strategy's setup, run the relevant indicator(s) over it, find the index where the strategy's actual entry signal fires, then hand that to `computeTrade` to derive the stop-loss/take-profit/exit. Because the series is randomly generated (deterministically, per a fixed seed), **you must verify empirically that each strategy's entry signal actually fires and that its trade resolves before the data runs out** — the shape parameters (drift/volatility per phase) below were chosen to make this very likely, not mathematically guaranteed. This is exactly what Step 4's invariant tests check, so if a test fails (especially "resolves every strategy's trade... never falls through to end-of-data"), the fix is to adjust that one strategy's `seed`, `count`, `driftAt`, or `volatilityAt` values and regenerate — not to change the invariant.

**Files:**
- Create: `lib/strategies/data.ts`, `lib/strategies/data.test.ts`

- [ ] **Step 1: Write failing tests — `lib/strategies/data.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { STRATEGIES } from "./data";

describe("STRATEGIES", () => {
  it("has exactly 6 strategies with unique ids", () => {
    expect(STRATEGIES).toHaveLength(6);
    const ids = STRATEGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("covers all six categories exactly once", () => {
    const categories = STRATEGIES.map((s) => s.category).sort();
    expect(categories).toEqual(
      ["Breakout", "Chart Pattern", "Mean Reversion", "Momentum", "Trend Following", "Volatility Breakout"].sort()
    );
  });

  it("includes both long and short entry types", () => {
    const types = new Set(STRATEGIES.map((s) => s.entryType));
    expect(types.has("long")).toBe(true);
    expect(types.has("short")).toBe(true);
  });

  it("places the entry within the candle series and the exit strictly after it", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.entryIndex).toBeGreaterThan(0);
      expect(strategy.entryIndex).toBeLessThan(strategy.candles.length);
      expect(strategy.exitIndex).toBeGreaterThan(strategy.entryIndex);
      expect(strategy.exitIndex).toBeLessThan(strategy.candles.length);
    }
  });

  it("orders long-trade levels as stop-loss < entry < take-profit, and short-trade levels the other way", () => {
    for (const strategy of STRATEGIES) {
      if (strategy.entryType === "long") {
        expect(strategy.stopLossPrice).toBeLessThan(strategy.entryPrice);
        expect(strategy.entryPrice).toBeLessThan(strategy.takeProfitPrice);
      } else {
        expect(strategy.takeProfitPrice).toBeLessThan(strategy.entryPrice);
        expect(strategy.entryPrice).toBeLessThan(strategy.stopLossPrice);
      }
    }
  });

  it("resolves every strategy's trade before the data runs out (never falls through to end-of-data)", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.exitReason).not.toBe("end-of-data");
    }
  });

  it("gives every strategy a non-empty name and a substantive description", () => {
    for (const strategy of STRATEGIES) {
      expect(strategy.name.length).toBeGreaterThan(0);
      expect(strategy.description.length).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/strategies/data.test.ts`
Expected: FAIL — cannot find module `./data`

- [ ] **Step 3: Implement `lib/strategies/data.ts`**

```ts
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
  for (let i = 20; i < candles.length - 1; i++) {
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
    driftAt: (i) => (i < 30 ? -0.1 : 0.3),
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
  const driftAt = (i: number) => {
    const phase = Math.floor(i / phaseLength);
    switch (phase) {
      case 0:
        return 0.5; // rise to left shoulder
      case 1:
        return -0.4; // fall to trough 1
      case 2:
        return 0.7; // rise to head (higher than left shoulder)
      case 3:
        return -0.4; // fall to trough 2
      case 4:
        return 0.5; // rise to right shoulder (similar height to left shoulder)
      default:
        return -0.6; // break down through the neckline and continue lower
    }
  };
  const candles = generateWalk({ seed: 6, count: 70, startPrice: 100, driftAt, volatilityAt: () => 0.6 });

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
```

- [ ] **Step 4: Run to verify it passes — and empirically sanity-check each strategy**

Run: `npx vitest run lib/strategies/data.test.ts`
Expected: PASS (6 tests)

If any test fails — especially the "never falls through to end-of-data" one — that strategy's generated series didn't produce a clean signal/resolution with its current `seed`/`driftAt`/`volatilityAt`. Debug by temporarily logging that strategy's `entryIndex`, `exitIndex`, and `exitReason` (e.g., `console.log(JSON.stringify(STRATEGIES.map(s => ({id: s.id, entryIndex: s.entryIndex, exitIndex: s.exitIndex, exitReason: s.exitReason})), null, 2))` in a scratch script or temporarily in the test file), inspect which one is off, and adjust that strategy's `seed` (try a few small integers) or widen its post-entry drift/volatility until the trade resolves cleanly. Remove any temporary logging before committing.

- [ ] **Step 5: Commit**

```bash
git add lib/strategies/data.ts lib/strategies/data.test.ts
git commit -m "feat: add six curated trading strategies with derived entry/exit signals"
```

---

### Task 5: Animated strategy demo chart

Like Phase 1's `CandlestickChart`, `lightweight-charts` renders to canvas and isn't meaningfully testable in jsdom — the test mocks the library and asserts the *wiring* (the right data/markers reach the mocked series at the right animation step), using fake timers to advance the animation deterministically instead of waiting on real time. Phase 1's chart went through two rounds of bug fixes for stale-closure/cleanup issues after `useEffect` teardown — this component uses the same `cancelled`-flag guard pattern from the start.

**Files:**
- Create: `components/strategies/strategy-demo-chart.tsx`, `components/strategies/strategy-demo-chart.test.tsx`

- [ ] **Step 1: Write failing tests — `components/strategies/strategy-demo-chart.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Strategy } from "@/lib/strategies/data";

const setData = vi.fn();
const setMarkers = vi.fn();
const createPriceLine = vi.fn();
const chartRemove = vi.fn();
const addCandlestickSeries = vi.fn();
const createChart = vi.fn();

vi.mock("lightweight-charts", () => ({
  createChart: (...args: unknown[]) => createChart(...args),
}));

import { StrategyDemoChart } from "./strategy-demo-chart";

const testStrategy: Strategy = {
  id: "test-strategy",
  name: "Test Strategy",
  category: "Trend Following",
  description: "A test strategy.",
  candles: [
    { time: 0, open: 100, high: 101, low: 99, close: 100 },
    { time: 86400, open: 100, high: 102, low: 99, close: 101 },
    { time: 172800, open: 101, high: 103, low: 100, close: 102 },
    { time: 259200, open: 102, high: 104, low: 101, close: 103 },
  ],
  entryIndex: 1,
  entryType: "long",
  entryPrice: 101,
  stopLossPrice: 99,
  takeProfitPrice: 105,
  exitIndex: 3,
  exitReason: "take-profit",
};

describe("StrategyDemoChart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setData.mockClear();
    setMarkers.mockClear();
    createPriceLine.mockClear();
    chartRemove.mockClear();
    addCandlestickSeries.mockReturnValue({ setData, setMarkers, createPriceLine });
    createChart.mockReturnValue({ addCandlestickSeries, remove: chartRemove });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("draws the take-profit and stop-loss reference lines on mount", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);
    expect(createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 105 }));
    expect(createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 99 }));
  });

  it("reveals candles one at a time and places an entry marker once the reveal reaches the entry index", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);

    vi.advanceTimersByTime(120);
    expect(setData).toHaveBeenLastCalledWith([expect.objectContaining({ close: 100 })]);
    expect(setMarkers).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(setData.mock.calls.at(-1)?.[0]).toHaveLength(2);
    expect(setMarkers).toHaveBeenLastCalledWith([expect.objectContaining({ text: "Entry" })]);
  });

  it("places an exit marker once the reveal reaches the exit index", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);

    vi.advanceTimersByTime(120 * 4);
    expect(setMarkers).toHaveBeenLastCalledWith([
      expect.objectContaining({ text: "Entry" }),
      expect.objectContaining({ text: "Take Profit" }),
    ]);
  });

  it("stops updating after unmount instead of firing into a removed chart", () => {
    const { unmount } = render(<StrategyDemoChart strategy={testStrategy} />);
    vi.advanceTimersByTime(120);
    const callsBeforeUnmount = setData.mock.calls.length;

    unmount();
    vi.advanceTimersByTime(5000);

    expect(setData.mock.calls.length).toBe(callsBeforeUnmount);
    expect(chartRemove).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/strategies/strategy-demo-chart.test.tsx`
Expected: FAIL — cannot find module `./strategy-demo-chart`

- [ ] **Step 3: Implement `components/strategies/strategy-demo-chart.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Strategy } from "@/lib/strategies/data";

export interface StrategyDemoChartProps {
  strategy: Strategy;
}

const TICK_MS = 120;
const LOOP_PAUSE_MS = 1500;

export function StrategyDemoChart({ strategy }: StrategyDemoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const chart: IChartApi = createChart(containerRef.current, {
      height: 260,
      layout: { background: { color: "transparent" } },
    });
    const series: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries();

    series.createPriceLine({
      price: strategy.takeProfitPrice,
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      title: "TP",
    });
    series.createPriceLine({
      price: strategy.stopLossPrice,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      title: "SL",
    });

    function toPoint(index: number) {
      const c = strategy.candles[index];
      return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
    }

    let revealCount = 0;

    function step() {
      if (cancelled) return;
      revealCount += 1;
      series.setData(strategy.candles.slice(0, revealCount).map((_, i) => toPoint(i)));

      const markers: SeriesMarker<Time>[] = [];
      if (revealCount - 1 >= strategy.entryIndex) {
        markers.push({
          time: toPoint(strategy.entryIndex).time,
          position: strategy.entryType === "long" ? "belowBar" : "aboveBar",
          color: strategy.entryType === "long" ? "#22c55e" : "#ef4444",
          shape: strategy.entryType === "long" ? "arrowUp" : "arrowDown",
          text: "Entry",
        });
      }
      if (revealCount - 1 >= strategy.exitIndex) {
        markers.push({
          time: toPoint(strategy.exitIndex).time,
          position: strategy.entryType === "long" ? "aboveBar" : "belowBar",
          color: strategy.exitReason === "take-profit" ? "#22c55e" : "#ef4444",
          shape: "circle",
          text: strategy.exitReason === "take-profit" ? "Take Profit" : "Stop Loss",
        });
      }
      if (markers.length > 0) series.setMarkers(markers);

      if (revealCount >= strategy.candles.length) {
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          revealCount = 0;
          series.setMarkers([]);
          timeoutId = setTimeout(step, TICK_MS);
        }, LOOP_PAUSE_MS);
      } else {
        timeoutId = setTimeout(step, TICK_MS);
      }
    }

    timeoutId = setTimeout(step, TICK_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      chart.remove();
    };
  }, [strategy]);

  return <div ref={containerRef} data-testid="strategy-demo-chart" />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/strategies/strategy-demo-chart.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. If `SeriesMarker`/`Time`/marker `position`/`shape` string literals don't match the installed `lightweight-charts` version's exact type names, adjust the import/literals to match what that version actually exports — check `node_modules/lightweight-charts/dist/typings.d.ts` for the real names if needed.

- [ ] **Step 6: Commit**

```bash
git add components/strategies/strategy-demo-chart.tsx components/strategies/strategy-demo-chart.test.tsx
git commit -m "feat: add animated strategy demo chart"
```

---

### Task 6: Strategy card

**Files:**
- Create: `components/strategies/strategy-card.tsx`, `components/strategies/strategy-card.test.tsx`

- [ ] **Step 1: Write failing test — `components/strategies/strategy-card.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./strategy-demo-chart", () => ({
  StrategyDemoChart: () => <div data-testid="demo-chart-stub" />,
}));

import { StrategyCard } from "./strategy-card";
import { STRATEGIES } from "@/lib/strategies/data";

describe("StrategyCard", () => {
  it("renders the strategy's name, category, and description, and embeds the demo chart", () => {
    const strategy = STRATEGIES[0];
    render(<StrategyCard strategy={strategy} />);
    expect(screen.getByText(strategy.name)).toBeInTheDocument();
    expect(screen.getByText(strategy.category)).toBeInTheDocument();
    expect(screen.getByText(strategy.description)).toBeInTheDocument();
    expect(screen.getByTestId("demo-chart-stub")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/strategies/strategy-card.test.tsx`
Expected: FAIL — cannot find module `./strategy-card`

- [ ] **Step 3: Implement `components/strategies/strategy-card.tsx`**

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StrategyDemoChart } from "./strategy-demo-chart";
import type { Strategy } from "@/lib/strategies/data";

export interface StrategyCardProps {
  strategy: Strategy;
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{strategy.name}</CardTitle>
        <Badge variant="neutral">{strategy.category}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{strategy.description}</p>
        <StrategyDemoChart strategy={strategy} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/strategies/strategy-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/strategies/strategy-card.tsx components/strategies/strategy-card.test.tsx
git commit -m "feat: add strategy card"
```

---

### Task 7: Strategies page

This replaces the `ComingSoon` placeholder Phase 1's Task 11 put behind the `/strategies` nav link.

**Files:**
- Modify: `app/strategies/page.tsx` (currently `<ComingSoon title="Strategies" />` from Phase 1)
- Create: `app/strategies/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/strategies/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/strategies/strategy-card", () => ({
  StrategyCard: ({ strategy }: { strategy: { id: string; name: string } }) => (
    <div data-testid={`strategy-card-${strategy.id}`}>{strategy.name}</div>
  ),
}));

import StrategiesPage from "./page";
import { STRATEGIES } from "@/lib/strategies/data";

describe("StrategiesPage", () => {
  it("renders a card for every strategy, grouped under a heading for each category", () => {
    render(<StrategiesPage />);

    for (const strategy of STRATEGIES) {
      expect(screen.getByTestId(`strategy-card-${strategy.id}`)).toBeInTheDocument();
    }

    const categories = Array.from(new Set(STRATEGIES.map((s) => s.category)));
    for (const category of categories) {
      expect(screen.getByRole("heading", { name: category })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/strategies/page.test.tsx`
Expected: FAIL — the current `ComingSoon` placeholder page doesn't render any of these testids/headings

- [ ] **Step 3: Replace `app/strategies/page.tsx`**

```tsx
import { STRATEGIES, type StrategyCategory } from "@/lib/strategies/data";
import { StrategyCard } from "@/components/strategies/strategy-card";

export default function StrategiesPage() {
  const categories = Array.from(new Set(STRATEGIES.map((s) => s.category))) as StrategyCategory[];

  return (
    <main className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategies</h1>
        <p className="text-sm text-muted-foreground">
          Learn how common trading strategies work, with an animated example of each one playing out.
        </p>
      </div>
      {categories.map((category) => (
        <section key={category} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{category}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {STRATEGIES.filter((s) => s.category === category).map((strategy) => (
              <StrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/strategies/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite and production build**

Run: `npx vitest run`
Expected: PASS — every test file from this plan plus everything from Phase 1 passes

Run: `npm run build`
Expected: build completes with no errors

- [ ] **Step 6: Commit**

```bash
git add app/strategies/page.tsx app/strategies/page.test.tsx
git commit -m "feat: compose the strategies library page"
```

---

### Task 8: Manual browser verification

Same rationale as Phase 1's equivalent task: animation timing and visual fidelity can't be verified by the test suite. Unlike Phase 1, there's no live data involved, so this is a lighter check.

**Files:** none (verification only; fix forward in the relevant task's files if something's broken)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running)

- [ ] **Step 2: Open `/strategies` and confirm the page renders**

Navigate to `http://localhost:3000/strategies`. Confirm: the page title/intro text render, all 6 strategy category headings appear (Trend Following, Mean Reversion, Breakout, Volatility Breakout, Momentum, Chart Pattern), and all 6 strategy cards render with their name/category badge/description.

- [ ] **Step 3: Watch each demo animate**

For at least 2-3 of the cards, watch the chart for several seconds. Confirm: candles progressively draw in from left to right, an entry marker (arrow) appears partway through, an exit marker (circle, "Take Profit" or "Stop Loss") appears later, and after a brief pause the animation clears and restarts from the beginning. Confirm the Head & Shoulders card specifically shows a visually recognizable three-peak shape with a downward (short) entry arrow, not an upward one.

- [ ] **Step 4: Check the browser console**

No uncaught errors during page load or while the animations are looping.

- [ ] **Step 5: Toggle light mode**

Click the theme toggle in the nav. Confirm every strategy card re-themes correctly (readable contrast on the description text, category badge, and chart background) and the demo charts don't visually break (e.g. price lines/markers still legible against a light background).

- [ ] **Step 6: Confirm nav/footer still work from this page**

Confirm the top nav and footer render normally on `/strategies` (inherited from the root layout) and that navigating to `/` and back to `/strategies` doesn't leave any stuck animation state or duplicate chart instances (each visit should show a fresh set of 6 animating charts, not more).

- [ ] **Step 7: Fix forward if anything's broken**

If any check above fails, fix it in the relevant component, re-run that task's test file, and repeat this task's browser check before continuing.

- [ ] **Step 8: Stop the dev server and do a final commit if any fixes were made**

If Step 7 required changes:

```bash
git add -A
git commit -m "fix: address issues found in manual browser verification"
```

If no changes were needed, this task requires no commit.

---

## Plan Self-Review

**Spec coverage:** every element of the approved design spec is implemented — six strategies spanning all six named categories (Task 4), animated demo per strategy (Task 5), plain-language descriptions (Task 4/6), entry/TP/SL derived from generated data rather than hand-picked (Tasks 1-4), page replacing the `/strategies` placeholder (Task 7), deterministic seeded generation for reproducibility (Task 1), visual consistency with Phase 1's theme tokens/`Card`/`Badge` primitives (Tasks 5-7 reuse them directly, no new styling introduced). The design spec's one open question (how to author realistic sample data without hand-typing candles) is resolved by Task 1's seeded generator plus Task 4's per-strategy shape functions.

**Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code or an exact command with expected output. Task 4 explicitly acknowledges the one place where a value can't be known until the code actually runs (which seed/shape produces a clean signal) and gives a concrete debugging procedure rather than leaving it vague.

**Type consistency:** `GeneratedCandle` (Task 1) is used identically by `indicators.ts` (Task 2, via plain `number[]` extracted from candles — no type mismatch), `trade.ts` (Task 3), `data.ts` (Task 4), and `strategy-demo-chart.tsx` (Task 5, via `Strategy.candles`). `TradeOutcome` (Task 3: `entryPrice`, `stopLossPrice`, `takeProfitPrice`, `exitIndex`, `exitReason`) is spread directly into `Strategy` (Task 4) and consumed with the same field names in `StrategyDemoChart` (Task 5). `StrategyCategory`'s six literal values (Task 4) are exactly the six category names asserted in Task 4's own test and reused unchanged in Task 7's page/test.

