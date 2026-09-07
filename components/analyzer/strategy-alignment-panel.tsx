"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "@/components/markets/stale-badge";
import { useLiveStrategyCheck, type AlignmentStatus } from "@/lib/analyzer/live-strategy-check";
import type { TradeDirection } from "@/lib/analyzer/calculations";

export interface StrategyAlignmentPanelProps {
  symbol: string;
  direction: TradeDirection;
}

const STATUS_LABEL: Record<AlignmentStatus, string> = {
  aligned: "Aligned",
  "not-yet": "Not Yet",
  "not-applicable": "N/A",
};

const STATUS_VARIANT: Record<AlignmentStatus, "up" | "down" | "neutral"> = {
  aligned: "up",
  "not-yet": "neutral",
  "not-applicable": "neutral",
};

export function StrategyAlignmentPanel({ symbol, direction }: StrategyAlignmentPanelProps) {
  const { data, isLoading, isStale } = useLiveStrategyCheck(symbol, direction);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Strategy Alignment</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {direction === "invalid" ? (
          <p className="text-sm text-muted-foreground">Enter a valid trade setup to see live strategy alignment.</p>
        ) : isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Live strategy data unavailable for {symbol}.</p>
        ) : (
          data.map((result) => (
            <div
              key={result.strategyId}
              className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{result.name}</span>
                <Badge variant={STATUS_VARIANT[result.status]}>{STATUS_LABEL[result.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{result.reason}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
