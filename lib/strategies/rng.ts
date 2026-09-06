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
