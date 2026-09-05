"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPrice, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "./stale-badge";

export function TickerStrip() {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "strip"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto border-b border-border px-6 py-2">
        {CURATED_SYMBOLS.map((s) => (
          <Skeleton key={s.symbol} className="h-5 w-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 overflow-x-auto border-b border-border px-6 py-2">
      {isStale && <StaleBadge />}
      {data?.map((ticker) => (
        <div key={ticker.symbol} className="flex shrink-0 items-center gap-2 text-sm">
          <span className="font-medium">{ticker.symbol}</span>
          <span>{formatPrice(ticker.lastPrice)}</span>
          <Badge variant={ticker.priceChangePercent >= 0 ? "up" : "down"}>
            {formatPercent(ticker.priceChangePercent)}
          </Badge>
        </div>
      ))}
    </div>
  );
}
