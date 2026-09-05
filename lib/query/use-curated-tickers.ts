import { useStaleAwareQuery } from "./use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";

export function useCuratedTickers() {
  return useStaleAwareQuery({
    queryKey: ["ticker24hr", "curated"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });
}
