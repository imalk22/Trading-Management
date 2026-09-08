import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { PortfolioStats } from "@/lib/portfolio/calculations";

export interface StatsSummaryProps {
  stats: PortfolioStats;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Stats</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Realized PnL</span>
          <span className={`text-sm font-medium ${stats.totalRealizedPnl >= 0 ? "text-up" : "text-down"}`}>
            ${formatPrice(stats.totalRealizedPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Unrealized PnL</span>
          <span className={`text-sm font-medium ${stats.totalUnrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
            ${formatPrice(stats.totalUnrealizedPnl)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Win Rate</span>
          <span className="text-sm font-medium">{stats.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Avg R:R Achieved</span>
          <span className="text-sm font-medium">
            {stats.averageRiskRewardAchieved === null ? "—" : `1:${stats.averageRiskRewardAchieved.toFixed(2)}`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Open Risk</span>
          <span className="text-sm font-medium">{stats.openRiskPercent.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
