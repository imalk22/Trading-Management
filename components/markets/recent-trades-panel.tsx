"use client";

import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceTrades } from "@/lib/binance/ws";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RecentTradesPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const trades = useBinanceTrades(selectedSymbol);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-muted-foreground">Recent Trades</h3>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      {trades.length === 0 && <p className="text-xs text-muted-foreground">Connecting…</p>}
      {trades.map((trade) => (
        <div key={trade.id} className="grid grid-cols-3 text-xs">
          <span className={cn(trade.isBuyerMaker ? "text-down" : "text-up")}>
            {formatPrice(trade.price)}
          </span>
          <span className="text-right">{trade.quantity.toFixed(4)}</span>
          <span className="text-right">
            {new Date(trade.time).toLocaleTimeString([], { hour12: false })}
          </span>
        </div>
      ))}
    </div>
  );
}
