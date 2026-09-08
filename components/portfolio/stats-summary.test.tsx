import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsSummary } from "./stats-summary";
import type { PortfolioStats } from "@/lib/portfolio/calculations";

const baseStats: PortfolioStats = {
  totalRealizedPnl: 150,
  totalUnrealizedPnl: -30,
  winRate: 66.67,
  averageRiskRewardAchieved: 2.5,
  openRiskPercent: 1.25,
};

describe("StatsSummary", () => {
  it("renders realized and unrealized PnL, win rate, average R:R, and open risk", () => {
    render(<StatsSummary stats={baseStats} />);
    expect(screen.getByText("$150.00")).toBeInTheDocument();
    expect(screen.getByText("$-30.00")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
    expect(screen.getByText("1:2.50")).toBeInTheDocument();
    expect(screen.getByText("1.25%")).toBeInTheDocument();
  });

  it("shows a dash for average risk:reward when no trade has a defined stop-loss", () => {
    render(<StatsSummary stats={{ ...baseStats, averageRiskRewardAchieved: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
