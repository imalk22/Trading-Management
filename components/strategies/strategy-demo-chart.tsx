"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Strategy } from "@/lib/strategies/data";

export interface StrategyDemoChartProps {
  strategy: Strategy;
}

const TICK_MS = 120;
const LOOP_PAUSE_MS = 1500;

export function StrategyDemoChart({ strategy }: StrategyDemoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const chart: IChartApi = createChart(containerRef.current, {
      height: 260,
      layout: { background: { color: "transparent" } },
    });
    const series: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries();

    series.createPriceLine({
      price: strategy.takeProfitPrice,
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      title: "TP",
    });
    series.createPriceLine({
      price: strategy.stopLossPrice,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      title: "SL",
    });

    function toPoint(index: number) {
      const c = strategy.candles[index];
      return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
    }

    let revealCount = 0;

    function step() {
      if (cancelled) return;
      revealCount += 1;
      series.setData(strategy.candles.slice(0, revealCount).map((_, i) => toPoint(i)));

      const markers: SeriesMarker<Time>[] = [];
      if (revealCount - 1 >= strategy.entryIndex) {
        markers.push({
          time: toPoint(strategy.entryIndex).time,
          position: strategy.entryType === "long" ? "belowBar" : "aboveBar",
          color: strategy.entryType === "long" ? "#22c55e" : "#ef4444",
          shape: strategy.entryType === "long" ? "arrowUp" : "arrowDown",
          text: "Entry",
        });
      }
      if (revealCount - 1 >= strategy.exitIndex) {
        markers.push({
          time: toPoint(strategy.exitIndex).time,
          position: strategy.entryType === "long" ? "aboveBar" : "belowBar",
          color: strategy.exitReason === "take-profit" ? "#22c55e" : "#ef4444",
          shape: "circle",
          text: strategy.exitReason === "take-profit" ? "Take Profit" : "Stop Loss",
        });
      }
      if (markers.length > 0) series.setMarkers(markers);

      if (revealCount >= strategy.candles.length) {
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          revealCount = 0;
          series.setMarkers([]);
          timeoutId = setTimeout(step, TICK_MS);
        }, LOOP_PAUSE_MS);
      } else {
        timeoutId = setTimeout(step, TICK_MS);
      }
    }

    timeoutId = setTimeout(step, TICK_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      chart.remove();
    };
  }, [strategy]);

  return <div ref={containerRef} data-testid="strategy-demo-chart" />;
}
