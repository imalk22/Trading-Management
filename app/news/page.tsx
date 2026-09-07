"use client";

import { useState } from "react";
import { useNews } from "@/lib/query/use-news";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { NewsCard } from "@/components/news/news-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewsPage() {
  const { data: articles, isLoading } = useNews();
  const [searchQuery, setSearchQuery] = useState("");
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set());

  function toggleSource(name: string) {
    setExcludedSources((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredArticles = (articles ?? []).filter((article) => {
    if (excludedSources.has(article.source)) return false;
    if (!query) return true;
    return (
      article.title.toLowerCase().includes(query) || article.summary.toLowerCase().includes(query)
    );
  });

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">News</h1>
        <p className="text-sm text-muted-foreground">
          Live headlines from CoinDesk, Cointelegraph, Decrypt, and The Block.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search news..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {NEWS_SOURCES.map((source) => (
            <Button
              key={source.name}
              variant={excludedSources.has(source.name) ? "outline" : "default"}
              size="sm"
              onClick={() => toggleSource(source.name)}
            >
              {source.name}
            </Button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : filteredArticles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No articles match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </main>
  );
}
