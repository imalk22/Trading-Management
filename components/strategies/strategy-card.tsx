import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StrategyDemoChart } from "./strategy-demo-chart";
import type { Strategy } from "@/lib/strategies/data";

export interface StrategyCardProps {
  strategy: Strategy;
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{strategy.name}</CardTitle>
        <Badge variant="neutral">{strategy.category}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{strategy.description}</p>
        <StrategyDemoChart strategy={strategy} />
      </CardContent>
    </Card>
  );
}
