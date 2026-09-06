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
