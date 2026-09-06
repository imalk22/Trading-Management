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

  // Regression test pinning a known, accepted fragility: evaluateHeadAndShouldersLive always
  // takes the 3 MOST RECENT swing highs as the shoulders/head, rather than tracking a specific
  // pattern once found. So a real, already-confirmed head-and-shoulders can stop being
  // recognized the moment any new swing high forms afterward - even a normal post-breakdown
  // bounce - because that new high displaces the original head from the last-3 window and
  // typically fails the head-tallest check. This is documented as intentional in
  // head-and-shoulders-live.ts; this test just makes sure the behavior doesn't silently change.
  it("loses recognition of an already-confirmed pattern once a post-breakdown bounce forms a new swing high (documents a known tradeoff of always using the 3 most recent swing highs)", () => {
    const phaseLength = 10;
    // Same seed/5-phase drift for indices 0-69 as the first test (proven left
    // shoulder/head/right shoulder/breakdown), extended with a bounce-then-pullback for
    // indices 70-89 so a new swing high actually registers around index 80 - a flat bounce
    // alone doesn't reverse in time to register as a local max before the series ends.
    const driftAt = (i: number) => {
      if (i >= 80) return -0.5; // pull back, letting the bounce's peak register as a swing high
      if (i >= 70) return 0.7; // modest post-breakdown bounce
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
    const candles = generateWalk({ seed: 21, count: 90, startPrice: 100, driftAt, volatilityAt: () => 0.6 });

    const result = evaluateHeadAndShouldersLive(candles.map((c) => ({ high: c.high, low: c.low, close: c.close })));
    expect(result.aligned).toBe(false);
  });

  // Regression test pinning a second known, accepted fragility: the neckline is the single
  // LOWEST swing low found anywhere between the shoulders, not the specific "two-touch" line a
  // chart-reader would draw through the two troughs. So one outlier wick anywhere in that
  // range (common on real crypto candles) can pull the neckline down and flip the alignment
  // verdict, even with the shoulders/head/close all unchanged. Documented as intentional in
  // head-and-shoulders-live.ts; this test pins that today's behavior does flip on such a wick.
  it("has its neckline (and thus its verdict) corrupted by a single outlier wick between the shoulders (documents a known tradeoff of the min-of-all-troughs neckline)", () => {
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
    const candles = generateWalk({ seed: 21, count: 70, startPrice: 100, driftAt, volatilityAt: () => 0.6 });
    const baseline = candles.slice(0, 63).map((c) => ({ high: c.high, low: c.low, close: c.close }));

    // Confirm the baseline is aligned (proven by the first test) before corrupting it, so the
    // flip below is clearly caused by the outlier and not some other difference.
    expect(evaluateHeadAndShouldersLive(baseline).aligned).toBe(true);

    // Shallow-copy the array and override a single candle's low, inside the left-shoulder-to-
    // head range (index 14), with a deep outlier wick far below the surrounding ~100-106 lows.
    const withOutlierWick = baseline.map((c, i) => (i === 14 ? { ...c, low: 85 } : c));

    const result = evaluateHeadAndShouldersLive(withOutlierWick);
    expect(result.aligned).toBe(false);
  });
});
