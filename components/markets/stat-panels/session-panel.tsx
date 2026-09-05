"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchLongShortRatio, fetchFundingRate, fetchOpenInterestChange } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceDepth } from "@/lib/binance/ws";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPercent } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function SessionPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;
  const hasFutures = symbolInfo.futuresSymbol !== null;
  const depth = useBinanceDepth(selectedSymbol);

  const {
    data: ratio,
    isStale: ratioStale,
    isLoading: ratioLoading,
  } = useStaleAwareQuery({
    queryKey: ["longShortRatio", "session", selectedSymbol],
    queryFn: () => fetchLongShortRatio(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 60_000,
  });

  const {
    data: funding,
    isStale: fundingStale,
    isLoading: fundingLoading,
  } = useStaleAwareQuery({
    queryKey: ["fundingRate", "session", selectedSymbol],
    queryFn: () => fetchFundingRate(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 60_000,
  });

  const {
    data: oiChange,
    isStale: oiStale,
    isLoading: oiLoading,
  } = useStaleAwareQuery({
    queryKey: ["openInterestChange", selectedSymbol],
    queryFn: () => fetchOpenInterestChange(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 5 * 60_000,
  });

  if (!hasFutures) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Not available for {symbolInfo.symbol}</p>
        </CardContent>
      </Card>
    );
  }

  const longPercent = ratio
    ? Math.round((ratio.longAccount / (ratio.longAccount + ratio.shortAccount)) * 100)
    : null;
  const basisPercent = funding ? ((funding.markPrice - funding.indexPrice) / funding.indexPrice) * 100 : null;
  const bestBid = depth?.bids[0]?.price;
  const bestAsk = depth?.asks[0]?.price;
  const spreadBps = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 10_000 : null;
  const isStale = ratioStale || fundingStale || oiStale;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Session</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Long / Short</p>
          {ratioLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {longPercent === null ? "—" : `${longPercent} / ${100 - longPercent}`}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">OI Change 1h</p>
          {oiLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{oiChange ? formatPercent(oiChange.changePercent) : "—"}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Basis</p>
          {fundingLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{basisPercent === null ? "—" : formatPercent(basisPercent)}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spread</p>
          {spreadBps === null ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{spreadBps.toFixed(1)} bps</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
