"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTradeStore, hydrateTradesFromStorage } from "@/lib/portfolio/trade-store";
import { useOpenTradePrices } from "@/lib/query/use-open-trade-prices";
import { TradeForm, type NewTradeInput } from "@/components/portfolio/trade-form";
import { TradeRow } from "@/components/portfolio/trade-row";

function generateTradeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function TradeDeskPage() {
  const trades = useTradeStore((s) => s.trades);
  const addTrade = useTradeStore((s) => s.addTrade);
  const closeTrade = useTradeStore((s) => s.closeTrade);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);

  useLayoutEffect(() => {
    hydrateTradesFromStorage();
  }, []);

  const openTrades = useMemo(() => trades.filter((t) => t.closedAt === null), [trades]);
  const openSymbols = useMemo(() => openTrades.map((t) => t.symbol), [openTrades]);
  const { data: prices } = useOpenTradePrices(openSymbols);

  function handleSubmit(input: NewTradeInput) {
    addTrade({
      id: generateTradeId(),
      ...input,
      openedAt: Date.now(),
      exitPrice: null,
      closedAt: null,
    });
  }

  function handleClose(id: string, exitPrice: number) {
    closeTrade(id, exitPrice, Date.now());
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Trade Desk</h1>
        <p className="text-sm text-muted-foreground">Log new trades and track your open positions.</p>
      </div>
      <TradeForm onSubmit={handleSubmit} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Open Positions</h2>
        {openTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades logged yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {openTrades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                currentPrice={prices?.[trade.symbol]}
                onClose={handleClose}
                onDelete={deleteTrade}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
