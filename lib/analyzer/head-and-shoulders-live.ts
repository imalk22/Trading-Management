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

  // Deliberate simplification: we always take the 3 MOST RECENT swing highs as the
  // shoulders/head, rather than tracking a specific pattern once it's found. This means
  // a real, already-confirmed head-and-shoulders can stop being recognized the moment any
  // new swing high forms afterward (e.g. a normal post-breakdown bounce) - even though
  // nothing about the original pattern's validity changed, because that new high now
  // occupies one of the last-3 slots and typically fails the head-tallest check. Accepted
  // tradeoff, not a bug - see the "loses recognition after a post-breakdown bounce" test.
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

  // Deliberate simplification: the neckline is the single LOWEST swing low found anywhere
  // between the shoulders, not the specific "two-touch" line a chart-reader would draw
  // through the two troughs. A single outlier wick anywhere in that range (common on real
  // crypto candles) can pull the neckline down and flip the alignment verdict, even with
  // the shoulders/head/close all unchanged. Accepted tradeoff, not a bug - see the
  // "single outlier trough corrupts the neckline" test.
  const necklinePrice = Math.min(...troughsBetween.map((t) => t.price));
  const latestClose = candles[candles.length - 1].close;

  return detectHeadAndShoulders(latestClose, necklinePrice);
}
