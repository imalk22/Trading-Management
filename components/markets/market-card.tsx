"use client";

import { cn } from "@/lib/utils";
import { formatPrice, formatPercent, formatCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { Ticker24hr } from "@/lib/binance/rest";
import type { SymbolInfo } from "@/lib/symbols";

export interface MarketCardProps {
  info: SymbolInfo;
  ticker?: Ticker24hr;
  selected: boolean;
  onSelect: () => void;
}

export function MarketCard({ info, ticker, selected, onSelect }: MarketCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-primary bg-muted" : "border-border hover:bg-muted"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{info.symbol}</span>
        {ticker && (
          <Badge variant={ticker.priceChangePercent >= 0 ? "up" : "down"}>
            {formatPercent(ticker.priceChangePercent)}
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{info.name}</span>
      <span className="text-lg font-bold">{ticker ? formatPrice(ticker.lastPrice) : "—"}</span>
      <span className="text-xs text-muted-foreground">
        Vol {ticker ? formatCompact(ticker.quoteVolume) : "—"}
      </span>
    </button>
  );
}
