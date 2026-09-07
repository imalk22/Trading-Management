import { NextResponse } from "next/server";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { parseRssFeed } from "@/lib/news/parse-rss";
import type { NewsArticle } from "@/lib/news/types";

let cache: { articles: NewsArticle[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

async function fetchSourceArticles(source: { name: string; url: string }): Promise<NewsArticle[]> {
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`Failed to fetch ${source.name}: ${res.status}`);
  const xml = await res.text();
  return parseRssFeed(xml, source.name);
}

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ articles: cache.articles });
  }

  const results = await Promise.allSettled(NEWS_SOURCES.map(fetchSourceArticles));

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[news] ${NEWS_SOURCES[i].name} failed:`, result.reason);
    }
  });

  const articles = results
    .filter((r): r is PromiseFulfilledResult<NewsArticle[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  if (articles.length > 0) {
    cache = { articles, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return NextResponse.json({ articles });
}
