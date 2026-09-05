import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketCard } from "./market-card";

const info = { symbol: "BTCUSDT", name: "Bitcoin", futuresSymbol: "BTCUSDT" };
const ticker = {
  symbol: "BTCUSDT",
  lastPrice: 80243.35,
  priceChangePercent: 2.14,
  highPrice: 81687.73,
  lowPrice: 78798.97,
  volume: 59234.12,
  quoteVolume: 4_820_000_000,
};

describe("MarketCard", () => {
  it("shows the asset name, price, and an up badge for positive change", () => {
    render(<MarketCard info={info} ticker={ticker} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("80,243.35")).toBeInTheDocument();
    expect(screen.getByText("+2.14%")).toHaveClass("text-up");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<MarketCard info={info} ticker={ticker} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("marks itself pressed when selected", () => {
    render(<MarketCard info={info} ticker={ticker} selected onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
