"use client";

import { useCuratedTickers } from "@/lib/query/use-curated-tickers";
import { formatPercent } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function LeadersPanel() {
  const { data, isLoading, isStale } = useCuratedTickers();

  const leaders = data ? [...data].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 3) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leaders</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : leaders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available</p>
        ) : (
          leaders.map((ticker) => (
            <div key={ticker.symbol} className="flex items-center justify-between text-sm">
              <span>{ticker.symbol.replace("USDT", "")}</span>
              <span className={ticker.priceChangePercent >= 0 ? "text-up" : "text-down"}>
                {formatPercent(ticker.priceChangePercent)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
