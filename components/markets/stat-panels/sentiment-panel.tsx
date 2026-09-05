"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchLongShortRatio } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function SentimentPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;

  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["longShortRatio", selectedSymbol],
    queryFn: () => fetchLongShortRatio(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  const buyPercent = data
    ? Math.round((data.longAccount / (data.longAccount + data.shortAccount)) * 100)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sentiment</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent>
        {symbolInfo.futuresSymbol === null ? (
          <p className="text-sm text-muted-foreground">Not available for {symbolInfo.symbol}</p>
        ) : isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : buyPercent === null ? (
          <p className="text-sm text-muted-foreground">Not available for {symbolInfo.symbol}</p>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-up">{buyPercent}% Buy</span>
            <span className="text-down">{100 - buyPercent}% Sell</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
