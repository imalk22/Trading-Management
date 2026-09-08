export type TradeDirection = "long" | "short";

export interface Trade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  units: number;
  openedAt: number;
  exitPrice: number | null;
  closedAt: number | null;
  notes: string;
}
