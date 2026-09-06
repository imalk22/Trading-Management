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
