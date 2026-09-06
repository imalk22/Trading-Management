import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/strategies/strategy-card", () => ({
  StrategyCard: ({ strategy }: { strategy: { id: string; name: string } }) => (
    <div data-testid={`strategy-card-${strategy.id}`}>{strategy.name}</div>
  ),
}));

import StrategiesPage from "./page";
import { STRATEGIES } from "@/lib/strategies/data";

describe("StrategiesPage", () => {
  it("renders a card for every strategy, grouped under a heading for each category", () => {
    render(<StrategiesPage />);

    for (const strategy of STRATEGIES) {
      expect(screen.getByTestId(`strategy-card-${strategy.id}`)).toBeInTheDocument();
    }

    const categories = Array.from(new Set(STRATEGIES.map((s) => s.category)));
    for (const category of categories) {
      expect(screen.getByRole("heading", { name: category })).toBeInTheDocument();
    }
  });
});
