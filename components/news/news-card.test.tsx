import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsCard } from "./news-card";
import type { NewsArticle } from "@/lib/news/types";

const baseArticle: NewsArticle = {
  id: "https://example.com/a1",
  title: "Bitcoin Breaks $80,000",
  link: "https://example.com/a1",
  source: "CoinDesk",
  publishedAt: Date.now() - 60_000,
  summary: "Bitcoin surged past a key level today.",
  imageUrl: "https://example.com/img.jpg",
};

describe("NewsCard", () => {
  it("renders the title as a link to the original article, opening in a new tab", () => {
    render(<NewsCard article={baseArticle} />);
    const link = screen.getByRole("link", { name: "Bitcoin Breaks $80,000" });
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the source badge and summary text", () => {
    render(<NewsCard article={baseArticle} />);
    expect(screen.getByText("CoinDesk")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin surged past a key level today.")).toBeInTheDocument();
  });

  it("renders the thumbnail image when imageUrl is present", () => {
    render(<NewsCard article={baseArticle} />);
    expect(screen.getByRole("img", { name: "Bitcoin Breaks $80,000" })).toHaveAttribute(
      "src",
      "https://example.com/img.jpg"
    );
  });

  it("renders without an image element when imageUrl is null", () => {
    render(<NewsCard article={{ ...baseArticle, imageUrl: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
