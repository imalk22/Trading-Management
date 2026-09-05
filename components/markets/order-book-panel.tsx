"use client";

import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceDepth } from "@/lib/binance/ws";
import { formatPrice } from "@/lib/format";

export function OrderBookPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const depth = useBinanceDepth(selectedSymbol);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-muted-foreground">Order Book</h3>
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Amount</span>
      </div>
      <div className="flex flex-col-reverse gap-0.5">
        {(depth?.asks ?? []).map((level) => (
          <div key={`ask-${level.price}`} className="grid grid-cols-2 text-xs">
            <span className="text-down">{formatPrice(level.price)}</span>
            <span className="text-right">{level.quantity.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {(depth?.bids ?? []).map((level) => (
          <div key={`bid-${level.price}`} className="grid grid-cols-2 text-xs">
            <span className="text-up">{formatPrice(level.price)}</span>
            <span className="text-right">{level.quantity.toFixed(4)}</span>
          </div>
        ))}
      </div>
      {!depth && <p className="text-xs text-muted-foreground">Connecting…</p>}
    </div>
  );
}
