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
  return { aligned: false, reason: `fast SMA (${curFast.toFixed(2)}) hasn't crossed above slow SMA (${curSlow.toFixed(2)}) yet` };
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
      : `price is at ${close.toFixed(2)}, hasn't closed above resistance (${resistance.toFixed(2)}) yet`,
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
      : `price is at ${breakoutClose.toFixed(2)}, hasn't closed above the upper band (${upperBand.toFixed(2)}) yet`,
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
  return { aligned: false, reason: "MACD line hasn't crossed above its signal line yet" };
}

export function detectHeadAndShoulders(close: number, necklinePrice: number): DetectionResult {
  const aligned = close < necklinePrice;
  return {
    aligned,
    reason: aligned
      ? `price closed at ${close.toFixed(2)}, below the neckline (${necklinePrice.toFixed(2)})`
      : `price is at ${close.toFixed(2)}, hasn't closed below the neckline (${necklinePrice.toFixed(2)}) yet`,
  };
}
