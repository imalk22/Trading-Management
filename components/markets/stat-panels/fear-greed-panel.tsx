"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchFearGreed } from "@/lib/external/fear-greed";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function FearGreedPanel() {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["fearGreed"],
    queryFn: fetchFearGreed,
    refetchInterval: 5 * 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fear & Greed Index</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-24" />
        ) : (
          <>
            <p className="text-3xl font-bold">{data?.value ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{data?.classification ?? "—"}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
