"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { fetchKlines, type Kline } from "@/lib/binance/rest";
import { useBinanceKline } from "@/lib/binance/ws";

export interface CandlestickChartProps {
  symbol: string;
  interval: string;
}

function toChartPoint(k: Kline) {
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
    const chart: IChartApi = createChart(containerRef.current, {
      height: 420,
      layout: { background: { color: "transparent" } },
    });
    const series = chart.addCandlestickSeries();
    seriesRef.current = series;

    fetchKlines(symbol, interval, 200).then((klines) => {
      series.setData(klines.map(toChartPoint));
    });

    return () => {
      chart.remove();
      seriesRef.current = null;
    };
  }, [symbol, interval]);

  useEffect(() => {
    if (!liveKline || !seriesRef.current) return;
    seriesRef.current.update({
      time: Math.floor(liveKline.openTime / 1000),
      open: liveKline.open,
      high: liveKline.high,
      low: liveKline.low,
      close: liveKline.close,
    } as never);
  }, [liveKline]);

  return <div ref={containerRef} data-testid="candlestick-chart" />;
}
