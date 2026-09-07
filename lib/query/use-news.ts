import { useStaleAwareQuery, type StaleAwareResult } from "./use-stale-query";
import type { NewsArticle } from "@/lib/news/types";

async function fetchNews(): Promise<NewsArticle[]> {
  const res = await fetch("/api/news");
  if (!res.ok) throw new Error(`Failed to fetch news: ${res.status}`);
  const body = await res.json();
  return body.articles;
}

export function useNews(): StaleAwareResult<NewsArticle[]> {
  return useStaleAwareQuery({
    queryKey: ["news"],
    queryFn: fetchNews,
    refetchInterval: 5 * 60_000,
  });
}
