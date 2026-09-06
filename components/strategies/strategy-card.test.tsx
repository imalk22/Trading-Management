import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./strategy-demo-chart", () => ({
  StrategyDemoChart: () => <div data-testid="demo-chart-stub" />,
}));

import { StrategyCard } from "./strategy-card";
import { STRATEGIES } from "@/lib/strategies/data";

describe("StrategyCard", () => {
  it("renders the strategy's name, category, and description, and embeds the demo chart", () => {
    const strategy = STRATEGIES[0];
    render(<StrategyCard strategy={strategy} />);
    expect(screen.getByText(strategy.name)).toBeInTheDocument();
    expect(screen.getByText(strategy.category)).toBeInTheDocument();
    expect(screen.getByText(strategy.description)).toBeInTheDocument();
    expect(screen.getByTestId("demo-chart-stub")).toBeInTheDocument();
  });
});
