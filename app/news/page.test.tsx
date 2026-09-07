import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { NewsArticle } from "@/lib/news/types";

const mockArticles: NewsArticle[] = [
  {
    id: "1",
    title: "Bitcoin Breaks $80,000",
    link: "https://example.com/1",
    source: "CoinDesk",
    publishedAt: Date.now(),
    summary: "Bitcoin surged today.",
    imageUrl: null,
  },
  {
    id: "2",
    title: "Ethereum Upgrade Ships",
    link: "https://example.com/2",
    source: "Decrypt",
    publishedAt: Date.now() - 1000,
    summary: "A major network upgrade went live.",
    imageUrl: null,
  },
];

vi.mock("@/lib/query/use-news", () => ({
  useNews: () => ({ data: mockArticles, isLoading: false, isStale: false }),
}));

import NewsPage from "./page";

describe("NewsPage", () => {
  it("renders every article by default", () => {
    render(<NewsPage />);
    expect(screen.getByText("Bitcoin Breaks $80,000")).toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("filters by search text across titles and summaries", () => {
    render(<NewsPage />);
    fireEvent.change(screen.getByPlaceholderText(/search news/i), { target: { value: "ethereum" } });
    expect(screen.queryByText("Bitcoin Breaks $80,000")).not.toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("filters by source when a source toggle is clicked off", () => {
    render(<NewsPage />);
    fireEvent.click(screen.getByRole("button", { name: "CoinDesk" }));
    expect(screen.queryByText("Bitcoin Breaks $80,000")).not.toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("shows a no-results message when filters exclude everything", () => {
    render(<NewsPage />);
    fireEvent.change(screen.getByPlaceholderText(/search news/i), { target: { value: "nonexistent topic" } });
    expect(screen.getByText(/no articles match/i)).toBeInTheDocument();
  });
});
