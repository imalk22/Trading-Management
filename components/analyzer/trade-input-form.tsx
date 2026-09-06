"use client";

import { CURATED_SYMBOLS } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface TradeFormValues {
  symbol: string;
  entryPrice: string;
  takeProfitPrice: string;
  stopLossPrice: string;
}

export interface TradeInputFormProps {
  values: TradeFormValues;
  onChange: (values: TradeFormValues) => void;
  accountBalance: number;
  onAccountBalanceChange: (value: number) => void;
  riskPercent: number;
  onRiskPercentChange: (value: number) => void;
}

const FIELD_CLASS = "rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none";

export function TradeInputForm({
  values,
  onChange,
  accountBalance,
  onAccountBalanceChange,
  riskPercent,
  onRiskPercentChange,
}: TradeInputFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Setup</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-sm">
          Symbol
          <select
            value={values.symbol}
            onChange={(e) => onChange({ ...values, symbol: e.target.value })}
            className={FIELD_CLASS}
          >
            {CURATED_SYMBOLS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Entry Price
          <input
            type="number"
            value={values.entryPrice}
            onChange={(e) => onChange({ ...values, entryPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Take Profit
          <input
            type="number"
            value={values.takeProfitPrice}
            onChange={(e) => onChange({ ...values, takeProfitPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Stop Loss
          <input
            type="number"
            value={values.stopLossPrice}
            onChange={(e) => onChange({ ...values, stopLossPrice: e.target.value })}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Account Balance ($)
          <input
            type="number"
            value={accountBalance}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                onAccountBalanceChange(parsed);
              }
            }}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Risk Per Trade (%)
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                onRiskPercentChange(parsed);
              }
            }}
            className={FIELD_CLASS}
          />
        </label>
      </CardContent>
    </Card>
  );
}
