"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTradeStore, hydrateTradesFromStorage } from "@/lib/portfolio/trade-store";
import { useAccountSettingsStore } from "@/lib/analyzer/account-settings-store";
import { useOpenTradePrices } from "@/lib/query/use-open-trade-prices";
import { computePortfolioStats } from "@/lib/portfolio/calculations";
import { StatsSummary } from "@/components/portfolio/stats-summary";
import { TradeRow } from "@/components/portfolio/trade-row";

export default function PortfolioPage() {
  const trades = useTradeStore((s) => s.trades);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);
  const accountBalance = useAccountSettingsStore((s) => s.accountBalance);

  useLayoutEffect(() => {
    hydrateTradesFromStorage();
  }, []);

  const closedTrades = useMemo(() => trades.filter((t) => t.closedAt !== null), [trades]);
  const openSymbols = useMemo(
    () => trades.filter((t) => t.closedAt === null).map((t) => t.symbol),
    [trades]
  );
  const { data: prices } = useOpenTradePrices(openSymbols);

  const stats = useMemo(
    () => computePortfolioStats(trades, accountBalance, prices ?? {}),
    [trades, accountBalance, prices]
  );

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your trading performance at a glance.</p>
      </div>
      <StatsSummary stats={stats} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Closed Trades</h2>
        {closedTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No closed trades yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {closedTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} onDelete={deleteTrade} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
