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
