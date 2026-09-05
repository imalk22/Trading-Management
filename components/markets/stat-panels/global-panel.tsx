"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchGlobalStats } from "@/lib/external/coingecko";
import { fetchOpenInterest } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatCompact } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function GlobalPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;

  const {
    data: globalStats,
    isStale: globalStale,
    isLoading: globalLoading,
  } = useStaleAwareQuery({
    queryKey: ["globalStats"],
    queryFn: fetchGlobalStats,
    refetchInterval: 60_000,
  });

  const {
    data: openInterest,
    isStale: oiStale,
    isLoading: oiLoading,
  } = useStaleAwareQuery({
    queryKey: ["openInterest", selectedSymbol],
    queryFn: () => fetchOpenInterest(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Global</CardTitle>
        {(globalStale || oiStale) && <StaleBadge />}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Market Cap</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `$${formatCompact(globalStats.totalMarketCapUsd)}` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">24h Volume</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `$${formatCompact(globalStats.totalVolumeUsd)}` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">BTC Dominance</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `${globalStats.btcDominance.toFixed(2)}%` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Open Interest ({symbolInfo.symbol.replace("USDT", "")})
          </p>
          {symbolInfo.futuresSymbol !== null && oiLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {symbolInfo.futuresSymbol === null
                ? "—"
                : openInterest
                  ? openInterest.openInterest.toLocaleString("en-US")
                  : "—"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
