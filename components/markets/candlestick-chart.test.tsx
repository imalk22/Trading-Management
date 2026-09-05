import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const addCandlestickSeries = vi.fn();
const chartRemove = vi.fn();
const createChart = vi.fn();

vi.mock("lightweight-charts", () => ({
  createChart: (...args: unknown[]) => createChart(...args),
}));

vi.mock("@/lib/binance/ws", () => ({
  useBinanceKline: () => null,
}));

vi.mock("@/lib/binance/rest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/binance/rest")>();
  return { ...actual, fetchKlines: vi.fn() };
});

import { CandlestickChart } from "./candlestick-chart";
import { fetchKlines } from "@/lib/binance/rest";

describe("CandlestickChart", () => {
  const setData = vi.fn();

  beforeEach(() => {
    setData.mockClear();
    addCandlestickSeries.mockReturnValue({ setData, update: vi.fn() });
    createChart.mockReturnValue({ addCandlestickSeries, remove: chartRemove });
    vi.mocked(fetchKlines).mockResolvedValue([
      {
        openTime: 1735689600000,
        open: 80000,
        high: 80500,
        low: 79800,
        close: 80243.35,
        volume: 120.5,
        closeTime: 1735690499999,
      },
    ]);
  });

  it("fetches klines for the given symbol/interval and plots them", async () => {
    render(<CandlestickChart symbol="BTCUSDT" interval="15m" />);

    expect(fetchKlines).toHaveBeenCalledWith("BTCUSDT", "15m", 200);

    await waitFor(() =>
      expect(setData).toHaveBeenCalledWith([
        { time: 1735689600, open: 80000, high: 80500, low: 79800, close: 80243.35 },
      ])
    );
  });
});
