"use client";

import { useState } from "react";
import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr, fetchFundingRate } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPrice, formatPercent } from "@/lib/format";
import { Tabs } from "@/components/ui/tabs";
import { CandlestickChart } from "./candlestick-chart";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// Binance's kline REST/WS interval parameter is lowercase ("1d", not "1D").
// "1D" is kept as the button label because that's the conventional way
// trading UIs display the daily timeframe.
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
};

export function ChartPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");

  const { data: ticker } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "chart", selectedSymbol],
    queryFn: async () => (await fetchTicker24hr([selectedSymbol]))[0],
    refetchInterval: 10_000,
  });

  const { data: funding } = useStaleAwareQuery({
    queryKey: ["fundingRate", selectedSymbol],
    queryFn: () => fetchFundingRate(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{symbolInfo.name}</h2>
          <p className="text-2xl font-bold">{ticker ? formatPrice(ticker.lastPrice) : "—"}</p>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>24h High {ticker ? formatPrice(ticker.highPrice) : "—"}</span>
          <span>24h Low {ticker ? formatPrice(ticker.lowPrice) : "—"}</span>
          <span>24h Change {ticker ? formatPercent(ticker.priceChangePercent) : "—"}</span>
          <span>
            Funding{" "}
            {symbolInfo.futuresSymbol === null || !funding
              ? "—"
              : formatPercent(funding.lastFundingRate * 100)}
          </span>
        </div>
        <Tabs value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} />
      </div>
      <CandlestickChart symbol={selectedSymbol} interval={BINANCE_INTERVAL[timeframe]} />
    </div>
  );
}
