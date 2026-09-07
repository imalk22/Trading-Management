"use client";

import { useLayoutEffect, useState } from "react";
import { useAccountSettingsStore, hydrateAccountSettingsFromStorage } from "@/lib/analyzer/account-settings-store";
import { inferDirection } from "@/lib/analyzer/calculations";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import { TradeInputForm, type TradeFormValues } from "@/components/analyzer/trade-input-form";
import { TradeSummaryPanel } from "@/components/analyzer/trade-summary-panel";
import { StrategyAlignmentPanel } from "@/components/analyzer/strategy-alignment-panel";

function parseNumberOrNull(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AnalyzerPage() {
  const [formValues, setFormValues] = useState<TradeFormValues>({
    symbol: DEFAULT_SYMBOL,
    entryPrice: "",
    takeProfitPrice: "",
    stopLossPrice: "",
  });
  const accountBalance = useAccountSettingsStore((s) => s.accountBalance);
  const riskPercent = useAccountSettingsStore((s) => s.riskPercent);
  const setAccountBalance = useAccountSettingsStore((s) => s.setAccountBalance);
  const setRiskPercent = useAccountSettingsStore((s) => s.setRiskPercent);

  useLayoutEffect(() => {
    hydrateAccountSettingsFromStorage();
  }, []);

  const entryPrice = parseNumberOrNull(formValues.entryPrice);
  const takeProfitPrice = parseNumberOrNull(formValues.takeProfitPrice);
  const stopLossPrice = parseNumberOrNull(formValues.stopLossPrice);

  const direction =
    entryPrice !== null && takeProfitPrice !== null && stopLossPrice !== null
      ? inferDirection(entryPrice, takeProfitPrice, stopLossPrice)
      : "invalid";

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Trade Analyzer</h1>
        <p className="text-sm text-muted-foreground">
          Enter a proposed trade to see its risk:reward, position size, and how it lines up against live market
          conditions for each strategy in the library.
        </p>
      </div>
      <TradeInputForm
        values={formValues}
        onChange={setFormValues}
        accountBalance={accountBalance}
        onAccountBalanceChange={setAccountBalance}
        riskPercent={riskPercent}
        onRiskPercentChange={setRiskPercent}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TradeSummaryPanel
          symbol={formValues.symbol}
          entryPrice={entryPrice}
          takeProfitPrice={takeProfitPrice}
          stopLossPrice={stopLossPrice}
          accountBalance={accountBalance}
          riskPercent={riskPercent}
        />
        <StrategyAlignmentPanel symbol={formValues.symbol} direction={direction} />
      </div>
    </main>
  );
}
