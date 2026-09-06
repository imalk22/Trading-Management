import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Strategy } from "@/lib/strategies/data";

const setData = vi.fn();
const setMarkers = vi.fn();
const createPriceLine = vi.fn();
const chartRemove = vi.fn();
const addCandlestickSeries = vi.fn();
const createChart = vi.fn();

vi.mock("lightweight-charts", () => ({
  createChart: (...args: unknown[]) => createChart(...args),
}));

import { StrategyDemoChart } from "./strategy-demo-chart";

const testStrategy: Strategy = {
  id: "test-strategy",
  name: "Test Strategy",
  category: "Trend Following",
  description: "A test strategy.",
  candles: [
    { time: 0, open: 100, high: 101, low: 99, close: 100 },
    { time: 86400, open: 100, high: 102, low: 99, close: 101 },
    { time: 172800, open: 101, high: 103, low: 100, close: 102 },
    { time: 259200, open: 102, high: 104, low: 101, close: 103 },
  ],
  entryIndex: 1,
  entryType: "long",
  entryPrice: 101,
  stopLossPrice: 99,
  takeProfitPrice: 105,
  exitIndex: 3,
  exitReason: "take-profit",
};

describe("StrategyDemoChart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setData.mockClear();
    setMarkers.mockClear();
    createPriceLine.mockClear();
    chartRemove.mockClear();
    addCandlestickSeries.mockReturnValue({ setData, setMarkers, createPriceLine });
    createChart.mockReturnValue({ addCandlestickSeries, remove: chartRemove });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("draws the take-profit and stop-loss reference lines on mount", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);
    expect(createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 105 }));
    expect(createPriceLine).toHaveBeenCalledWith(expect.objectContaining({ price: 99 }));
  });

  it("reveals candles one at a time and places an entry marker once the reveal reaches the entry index", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);

    vi.advanceTimersByTime(120);
    expect(setData).toHaveBeenLastCalledWith([expect.objectContaining({ close: 100 })]);
    expect(setMarkers).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(setData.mock.calls.at(-1)?.[0]).toHaveLength(2);
    expect(setMarkers).toHaveBeenLastCalledWith([expect.objectContaining({ text: "Entry" })]);
  });

  it("places an exit marker once the reveal reaches the exit index", () => {
    render(<StrategyDemoChart strategy={testStrategy} />);

    vi.advanceTimersByTime(120 * 4);
    expect(setMarkers).toHaveBeenLastCalledWith([
      expect.objectContaining({ text: "Entry" }),
      expect.objectContaining({ text: "Take Profit" }),
    ]);
  });

  it("stops updating after unmount instead of firing into a removed chart", () => {
    const { unmount } = render(<StrategyDemoChart strategy={testStrategy} />);
    vi.advanceTimersByTime(120);
    const callsBeforeUnmount = setData.mock.calls.length;

    unmount();
    vi.advanceTimersByTime(5000);

    expect(setData.mock.calls.length).toBe(callsBeforeUnmount);
    expect(chartRemove).toHaveBeenCalledOnce();
  });
});
