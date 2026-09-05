import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/markets/ticker-strip", () => ({ TickerStrip: () => <div data-testid="ticker-strip" /> }));
vi.mock("@/components/markets/markets-list", () => ({ MarketsList: () => <div data-testid="markets-list" /> }));
vi.mock("@/components/markets/chart-panel", () => ({ ChartPanel: () => <div data-testid="chart-panel" /> }));
vi.mock("@/components/markets/order-book-panel", () => ({
  OrderBookPanel: () => <div data-testid="order-book-panel" />,
}));
vi.mock("@/components/markets/recent-trades-panel", () => ({
  RecentTradesPanel: () => <div data-testid="recent-trades-panel" />,
}));
vi.mock("@/components/markets/stat-panels/fear-greed-panel", () => ({
  FearGreedPanel: () => <div data-testid="fear-greed-panel" />,
}));
vi.mock("@/components/markets/stat-panels/sentiment-panel", () => ({
  SentimentPanel: () => <div data-testid="sentiment-panel" />,
}));
vi.mock("@/components/markets/stat-panels/leaders-panel", () => ({
  LeadersPanel: () => <div data-testid="leaders-panel" />,
}));
vi.mock("@/components/markets/stat-panels/session-panel", () => ({
  SessionPanel: () => <div data-testid="session-panel" />,
}));
vi.mock("@/components/markets/stat-panels/global-panel", () => ({
  GlobalPanel: () => <div data-testid="global-panel" />,
}));

import Home from "./page";

describe("Home (markets dashboard page)", () => {
  it("composes every dashboard panel", () => {
    render(<Home />);
    for (const testId of [
      "ticker-strip",
      "markets-list",
      "chart-panel",
      "order-book-panel",
      "recent-trades-panel",
      "fear-greed-panel",
      "sentiment-panel",
      "leaders-panel",
      "session-panel",
      "global-panel",
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });
});
