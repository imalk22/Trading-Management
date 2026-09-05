"use client";

import { useCuratedTickers } from "@/lib/query/use-curated-tickers";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "./stale-badge";
import { MarketCard } from "./market-card";

export function MarketsList() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const selectSymbol = useSymbolStore((s) => s.selectSymbol);

  const { data, isLoading, isStale } = useCuratedTickers();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {CURATED_SYMBOLS.map((s) => (
          <Skeleton key={s.symbol} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isStale && <StaleBadge />}
      {CURATED_SYMBOLS.map((info) => (
        <MarketCard
          key={info.symbol}
          info={info}
          ticker={data?.find((t) => t.symbol === info.symbol)}
          selected={info.symbol === selectedSymbol}
          onSelect={() => selectSymbol(info.symbol)}
        />
      ))}
    </div>
  );
}
