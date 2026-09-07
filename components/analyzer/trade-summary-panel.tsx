"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "@/components/markets/stale-badge";
import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { formatPrice, formatPercent } from "@/lib/format";
import { inferDirection, computeRiskReward, computePositionSize, computeMaxLossGain } from "@/lib/analyzer/calculations";

export interface TradeSummaryPanelProps {
  symbol: string;
  entryPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  accountBalance: number;
  riskPercent: number;
}

export function TradeSummaryPanel({
  symbol,
  entryPrice,
  takeProfitPrice,
  stopLossPrice,
  accountBalance,
  riskPercent,
}: TradeSummaryPanelProps) {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", symbol],
    queryFn: () => fetchTicker24hr([symbol]),
    refetchInterval: 30_000,
  });
  const currentPrice = data?.[0]?.lastPrice;

  const hasAllInputs = entryPrice !== null && takeProfitPrice !== null && stopLossPrice !== null;
  const direction = hasAllInputs ? inferDirection(entryPrice, takeProfitPrice, stopLossPrice) : "invalid";

  let riskReward: number | null = null;
  let positionSize: ReturnType<typeof computePositionSize> | null = null;
  let maxLossGain: ReturnType<typeof computeMaxLossGain> | null = null;
  let currentPriceDiffPercent: number | undefined;

  if (hasAllInputs && direction !== "invalid") {
    riskReward = computeRiskReward(entryPrice, takeProfitPrice, stopLossPrice, direction);
    positionSize = computePositionSize(accountBalance, riskPercent, entryPrice, stopLossPrice);
    maxLossGain = computeMaxLossGain(
      positionSize.units,
      accountBalance,
      entryPrice,
      takeProfitPrice,
      stopLossPrice,
      direction
    );
    if (currentPrice !== undefined) {
      currentPriceDiffPercent = ((entryPrice - currentPrice) / currentPrice) * 100;
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Trade Summary</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {!hasAllInputs ? (
          <p className="text-muted-foreground">Enter an entry price, take-profit, and stop-loss to see the analysis.</p>
        ) : direction === "invalid" ? (
          <p className="text-down">
            This isn&apos;t a valid trade setup — take-profit and stop-loss must be on opposite sides of the entry price
            {stopLossPrice === entryPrice ? " (stop-loss cannot equal entry price)" : ""}.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Direction</span>
              <span className="font-medium capitalize">{direction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Risk:Reward</span>
              <span className="font-medium">1:{riskReward!.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-medium">
                {positionSize!.units.toFixed(4)} units (${formatPrice(positionSize!.notionalValue)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max Loss</span>
              <span className="font-medium text-down">
                ${formatPrice(maxLossGain!.maxLossAmount)} ({formatPercent(-maxLossGain!.maxLossPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max Gain</span>
              <span className="font-medium text-up">
                ${formatPrice(maxLossGain!.maxGainAmount)} ({formatPercent(maxLossGain!.maxGainPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Price</span>
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="font-medium">
                  {currentPrice === undefined
                    ? "—"
                    : `$${formatPrice(currentPrice)} (entry is ${formatPercent(currentPriceDiffPercent!)} away)`}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
