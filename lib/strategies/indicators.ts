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
