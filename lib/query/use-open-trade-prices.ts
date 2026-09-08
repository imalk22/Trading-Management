import { useStaleAwareQuery, type StaleAwareResult } from "./use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";

async function fetchPricesForSymbols(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const tickers = await fetchTicker24hr(symbols);
  const prices: Record<string, number> = {};
  for (const ticker of tickers) {
    prices[ticker.symbol] = ticker.lastPrice;
  }
  return prices;
}

export function useOpenTradePrices(symbols: string[]): StaleAwareResult<Record<string, number>> {
  const uniqueSymbols = Array.from(new Set(symbols)).sort();
  return useStaleAwareQuery({
    queryKey: ["openTradePrices", uniqueSymbols],
    queryFn: () => fetchPricesForSymbols(uniqueSymbols),
    refetchInterval: 30_000,
  });
}
