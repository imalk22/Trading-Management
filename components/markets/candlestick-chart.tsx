"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { fetchKlines, type BinanceInterval } from "@/lib/binance/rest";
import { useBinanceKline } from "@/lib/binance/ws";

export interface CandlestickChartProps {
  symbol: string;
  interval: BinanceInterval;
}

interface ChartPointSource {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function toChartPoint(k: ChartPointSource) {
  return {
    time: Math.floor(k.openTime / 1000) as UTCTimestamp,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  };
}

export function CandlestickChart({ symbol, interval }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const liveKline = useBinanceKline(symbol, interval);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const chart: IChartApi = createChart(containerRef.current, {
      height: 420,
      layout: { background: { color: "transparent" } },
    });
    const series = chart.addCandlestickSeries();
    seriesRef.current = series;

    fetchKlines(symbol, interval, 200)
      .then((klines) => {
        if (cancelled) return;
        series.setData(klines.map(toChartPoint));
      })
      .catch((error) => {
        console.error("Failed to load candlestick data", error);
      });

    return () => {
      cancelled = true;
      chart.remove();
      seriesRef.current = null;
    };
  }, [symbol, interval]);

  useEffect(() => {
    if (!liveKline || !seriesRef.current) return;
    seriesRef.current.update(toChartPoint(liveKline));
  }, [liveKline]);

  return <div ref={containerRef} data-testid="candlestick-chart" />;
}
