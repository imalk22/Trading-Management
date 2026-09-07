# News Aggregator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/news` page that merges live articles from four crypto news RSS feeds (CoinDesk, CoinTelegraph, Decrypt, The Block) into one feed sorted by recency, with client-side source filtering and search.

**Architecture:** A Route Handler (`app/api/news/route.ts`, mirroring Phase 1's `/api/global-stats`) fetches all four RSS feeds server-side in parallel, parses each with `fast-xml-parser`, normalizes into a shared `NewsArticle` shape, merges, sorts, and caches in-memory. The client fetches this merged JSON once and does all filtering/search locally over the already-loaded list.

**Tech Stack:** Next.js 15 Route Handlers, `fast-xml-parser` (new dependency, confirmed v5.11.1's real parsed-object shape during planning — see Task 1), TanStack Query (`useStaleAwareQuery`), Vitest + Testing Library.

---

### Task 1: RSS feed sources and parser

Establishes the fixed list of feeds and the pure parsing logic that turns raw RSS XML into `NewsArticle[]`. This is the highest-risk task in the plan because real feeds vary in exactly how they embed images and whether text is CDATA-wrapped — the test fixtures below are written to match the ACTUAL structural quirks found by fetching and inspecting all four feeds' live output during planning (not idealized/simplified XML).

**Files:**
- Create: `lib/news/sources.ts`
- Create: `lib/news/types.ts`
- Create: `lib/news/parse-rss.ts`, `lib/news/parse-rss.test.ts`

- [ ] **Step 1: Install the parsing dependency**

Run: `npm install fast-xml-parser`
Expected: adds `fast-xml-parser` (^5.x) to `package.json`'s `dependencies`.

This project already confirmed (during planning) that `fast-xml-parser` v5.11.1's `XMLParser` class, given:
```ts
new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", isArray: (name) => name === "item" })
```
parses an RSS `<item>` into a plain JS object where: text fields (`title`, `link`, `pubDate`, `description`) come through as plain strings regardless of whether the source wrapped them in `<![CDATA[...]]>` (no special CDATA handling needed in this project's own code); a self-closing tag with only attributes like `<media:content url="..." type="image/*"/>` becomes `{ "@_url": "...", "@_type": "..." }`; and `isArray` forces `item` to always be an array even when a feed has only one item. This was verified directly against real captured RSS output during planning, not assumed from documentation.

- [ ] **Step 2: Write `lib/news/sources.ts`**

```ts
export interface NewsSource {
  name: string;
  url: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
];
```

- [ ] **Step 3: Write `lib/news/types.ts`**

```ts
export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
  imageUrl: string | null;
}
```

- [ ] **Step 4: Write failing tests — `lib/news/parse-rss.test.ts`**

Each fixture below reproduces the actual structural shape of one real feed's `<item>`, found by fetching and inspecting all four feeds' live output during planning (image-tag placement, CDATA usage, and attribute layout all match what those feeds actually send).

```ts
import { describe, it, expect } from "vitest";
import { parseRssFeed } from "./parse-rss";

describe("parseRssFeed", () => {
  it("parses a CoinDesk-style item using media:content for its image, with a CDATA title", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title><![CDATA[Solana to triple transaction size as apps get room for more complex trades]]></title>
  <link>https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size</link>
  <media:content url="https://cdn.sanity.io/images/example/solana.png" type="image/*" medium="image"/>
  <guid isPermaLink="false">439b6a6f-5bd3-4e01-8707-8ac28ef798af</guid>
  <pubDate>Mon, 07 Sep 2026 12:08:11 +0000</pubDate>
  <description><![CDATA[A Transaction v1 feature activates Wednesday, allowing complex proofs to fit in one transaction.]]></description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "CoinDesk");

    expect(articles).toHaveLength(1);
    expect(articles[0]).toEqual({
      id: "https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size",
      title: "Solana to triple transaction size as apps get room for more complex trades",
      link: "https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size",
      source: "CoinDesk",
      publishedAt: Date.parse("Mon, 07 Sep 2026 12:08:11 +0000"),
      summary: "A Transaction v1 feature activates Wednesday, allowing complex proofs to fit in one transaction.",
      imageUrl: "https://cdn.sanity.io/images/example/solana.png",
    });
  });

  it("parses a Cointelegraph-style item, preferring media:content over the also-present enclosure and inline description image", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Zcash hits highest price since 2016 as market cap tops $20B</title>
  <pubDate>Mon, 07 Sep 2026 12:31:23 +0000</pubDate>
  <guid isPermaLink="true">https://cointelegraph.com/markets/zcash-highest-price</guid>
  <link><![CDATA[https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed]]></link>
  <description><![CDATA[<p style="float:right;"><img src="https://s3-images.ctmedia.io/media/zcash-inline.jpg" alt="Zcash"></p><p>ZEC gained 45% over the past week.</p>]]></description>
  <media:content url="https://s3-images.ctmedia.io/media/zcash-rally.jpg" width="528" medium="image"/>
  <enclosure url="https://s3-images.ctmedia.io/media/zcash-rally.jpg" length="528" type="image/jpeg"/>
  <category>Markets</category>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Cointelegraph");

    expect(articles).toHaveLength(1);
    expect(articles[0].imageUrl).toBe("https://s3-images.ctmedia.io/media/zcash-rally.jpg");
    expect(articles[0].link).toBe("https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed");
    expect(articles[0].id).toBe("https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed");
    expect(articles[0].summary).toBe("ZEC gained 45% over the past week.");
  });

  it("parses a Decrypt-style item with a plain (non-CDATA) title, falling back to enclosure when media:content is absent", () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Irish Gangs Are Renting Private Vaults to Hide Crypto Keys</title>
  <link>https://decrypt.co/377546/irish-gangs-are-renting-private-vaults</link>
  <pubDate>Mon, 07 Sep 2026 12:43:50 +0000</pubDate>
  <description>Keys are going into rented boxes alongside cash, watches and passports.</description>
  <guid isPermaLink="false">https://decrypt.co/?p=377546</guid>
  <enclosure url="https://img.decrypt.co/insecure/rs:fill/vault-decrypt.jpg" length="1000000" type="image/jpeg"/>
  <media:thumbnail url="https://cdn.decrypt.co/wp-content/uploads/vault-decrypt.jpg" height="1080" width="1920"/>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Decrypt");

    expect(articles).toHaveLength(1);
    expect(articles[0].imageUrl).toBe("https://img.decrypt.co/insecure/rs:fill/vault-decrypt.jpg");
    expect(articles[0].title).toBe("Irish Gangs Are Renting Private Vaults to Hide Crypto Keys");
  });

  it("falls back to media:thumbnail when neither media:content nor enclosure is present", () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Only thumbnail available</title>
  <link>https://example.com/thumb-only</link>
  <pubDate>Mon, 07 Sep 2026 10:00:00 +0000</pubDate>
  <description>desc</description>
  <media:thumbnail url="https://example.com/thumb.jpg" height="1080" width="1920"/>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBe("https://example.com/thumb.jpg");
  });

  it("falls back to the first inline <img> in the description when no media tag is present", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>No media tags, only inline image</title>
  <link>https://example.com/inline-only</link>
  <pubDate>Mon, 07 Sep 2026 09:00:00 +0000</pubDate>
  <description><![CDATA[<p><img src="https://example.com/inline.jpg" alt="x"></p><p>Some text here.</p>]]></description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBe("https://example.com/inline.jpg");
    expect(articles[0].summary).toBe("Some text here.");
  });

  it("returns null imageUrl when no image is found anywhere, without throwing", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>No image at all</title>
  <link>https://example.com/no-image</link>
  <pubDate>Mon, 07 Sep 2026 08:00:00 +0000</pubDate>
  <description>Plain text description, no markup.</description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBeNull();
    expect(articles[0].summary).toBe("Plain text description, no markup.");
  });

  it("returns an empty array for a feed with no items, without throwing", () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>Empty Feed</title></channel></rss>`;
    expect(parseRssFeed(xml, "Test Source")).toEqual([]);
  });

  it("skips a malformed item that's missing a link, rather than failing the whole feed", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>Missing link, should be skipped</title>
  <pubDate>Mon, 07 Sep 2026 07:00:00 +0000</pubDate>
  <description>desc</description>
</item>
<item>
  <title>Valid item</title>
  <link>https://example.com/valid</link>
  <pubDate>Mon, 07 Sep 2026 07:30:00 +0000</pubDate>
  <description>desc</description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles).toHaveLength(1);
    expect(articles[0].link).toBe("https://example.com/valid");
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx vitest run lib/news/parse-rss.test.ts`
Expected: FAIL — cannot find module `./parse-rss`

- [ ] **Step 6: Implement `lib/news/parse-rss.ts`**

```ts
import { XMLParser } from "fast-xml-parser";
import type { NewsArticle } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "item",
});

interface RawItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
  "media:content"?: { "@_url"?: string };
  "media:thumbnail"?: { "@_url"?: string };
  enclosure?: { "@_url"?: string };
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function extractInlineImage(description: string): string | null {
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function extractImageUrl(item: RawItem, description: string): string | null {
  if (item["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  if (item.enclosure?.["@_url"]) return item.enclosure["@_url"];
  if (item["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  return extractInlineImage(description);
}

export function parseRssFeed(xml: string, sourceName: string): NewsArticle[] {
  const parsed = parser.parse(xml);
  const items: RawItem[] = parsed?.rss?.channel?.item ?? [];

  const articles: NewsArticle[] = [];
  for (const item of items) {
    const link = asText(item.link);
    if (!link) continue;

    const rawDescription = asText(item.description);
    const publishedAt = Date.parse(asText(item.pubDate));

    articles.push({
      id: link,
      title: asText(item.title),
      link,
      source: sourceName,
      publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
      summary: stripHtml(rawDescription),
      imageUrl: extractImageUrl(item, rawDescription),
    });
  }

  return articles;
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run lib/news/parse-rss.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/news/sources.ts lib/news/types.ts lib/news/parse-rss.ts lib/news/parse-rss.test.ts
git commit -m "feat: add RSS feed sources and parser for news aggregator"
```

---

### Task 2: News API route handler

Fetches all four feeds in parallel, parses each with Task 1's `parseRssFeed`, merges + sorts by recency, and caches in-memory — mirroring `app/api/global-stats/route.ts`'s existing cache pattern. A single feed failing must not fail the whole request.

**Files:**
- Create: `app/api/news/route.ts`, `app/api/news/route.test.ts`

- [ ] **Step 1: Write failing tests — `app/api/news/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const COINDESK_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>CoinDesk Article</title>
  <link>https://www.coindesk.com/a1</link>
  <pubDate>Mon, 07 Sep 2026 12:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const COINTELEGRAPH_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>Cointelegraph Article</title>
  <link>https://cointelegraph.com/a1</link>
  <pubDate>Mon, 07 Sep 2026 13:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const DECRYPT_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>Decrypt Article</title>
  <link>https://decrypt.co/a1</link>
  <pubDate>Mon, 07 Sep 2026 11:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const THE_BLOCK_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>The Block Article</title>
  <link>https://www.theblock.co/a1</link>
  <pubDate>Mon, 07 Sep 2026 10:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

function mockFetchByUrl(responses: Record<string, { ok: boolean; text?: string }>) {
  return vi.fn((url: string) => {
    const match = Object.entries(responses).find(([key]) => url.includes(key));
    if (!match) return Promise.reject(new Error(`Unexpected URL: ${url}`));
    const [, response] = match;
    if (!response.ok) return Promise.resolve({ ok: false, status: 502 } as Response);
    return Promise.resolve({ ok: true, text: () => Promise.resolve(response.text!) } as Response);
  });
}

describe("GET /api/news", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges all four feeds and sorts by publish time, newest first", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: true, text: COINDESK_XML },
        "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
        "decrypt.co": { ok: true, text: DECRYPT_XML },
        "theblock.co": { ok: true, text: THE_BLOCK_XML },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.articles).toHaveLength(4);
    expect(body.articles.map((a: { source: string }) => a.source)).toEqual([
      "Cointelegraph",
      "CoinDesk",
      "Decrypt",
      "The Block",
    ]);
  });

  it("still returns the other sources' articles when one source's fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: false },
        "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
        "decrypt.co": { ok: true, text: DECRYPT_XML },
        "theblock.co": { ok: true, text: THE_BLOCK_XML },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.articles).toHaveLength(3);
    expect(body.articles.some((a: { source: string }) => a.source === "CoinDesk")).toBe(false);
  });

  it("returns an empty articles array, not an error, when every source fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: false },
        "cointelegraph.com": { ok: false },
        "decrypt.co": { ok: false },
        "theblock.co": { ok: false },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.articles).toEqual([]);
  });

  it("serves a cached response on a second call within the TTL without re-fetching", async () => {
    const fetchMock = mockFetchByUrl({
      "coindesk.com": { ok: true, text: COINDESK_XML },
      "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
      "decrypt.co": { ok: true, text: DECRYPT_XML },
      "theblock.co": { ok: true, text: THE_BLOCK_XML },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET();
    const callCountAfterFirst = fetchMock.mock.calls.length;
    await GET();
    const callCountAfterSecond = fetchMock.mock.calls.length;

    expect(callCountAfterFirst).toBe(4);
    expect(callCountAfterSecond).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/news/route.test.ts`
Expected: FAIL — cannot find module `./route`

- [ ] **Step 3: Implement `app/api/news/route.ts`**

```ts
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
  const articles = results
    .filter((r): r is PromiseFulfilledResult<NewsArticle[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  cache = { articles, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json({ articles });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/api/news/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add app/api/news/route.ts app/api/news/route.test.ts
git commit -m "feat: add /api/news route merging and caching all RSS sources"
```

---

### Task 3: `useNews` hook

A thin `useStaleAwareQuery`-based hook calling `/api/news`, matching every prior phase's data-fetching hook pattern (e.g. `TradeSummaryPanel`'s internal `useStaleAwareQuery` call in Phase 3).

**Files:**
- Create: `lib/query/use-news.ts`, `lib/query/use-news.test.tsx`

- [ ] **Step 1: Write failing tests — `lib/query/use-news.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useNews } from "./use-news";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNews", () => {
  it("fetches from /api/news and returns the articles array", async () => {
    const articles = [
      {
        id: "https://example.com/a1",
        title: "Test Article",
        link: "https://example.com/a1",
        source: "CoinDesk",
        publishedAt: Date.now(),
        summary: "summary",
        imageUrl: null,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ articles }) } as Response))
    );

    const { result } = renderHook(() => useNews(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(articles));
    expect(fetch).toHaveBeenCalledWith("/api/news");

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/query/use-news.test.tsx`
Expected: FAIL — cannot find module `./use-news`

- [ ] **Step 3: Implement `lib/query/use-news.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/query/use-news.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add lib/query/use-news.ts lib/query/use-news.test.tsx
git commit -m "feat: add useNews hook"
```

---

### Task 4: News card

Renders a single article: thumbnail (when present), source badge, title linking out to the original article, relative timestamp, and summary.

**Files:**
- Create: `components/news/news-card.tsx`, `components/news/news-card.test.tsx`
- Create: `lib/news/format-relative-time.ts`, `lib/news/format-relative-time.test.ts`

- [ ] **Step 1: Write failing tests — `lib/news/format-relative-time.test.ts`**

A small, focused pure-function helper for "2h ago"-style timestamps, kept separate from the component so its edge cases (exact boundaries) are trivial to test without rendering anything.

```ts
import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

describe("formatRelativeTime", () => {
  it("shows seconds for very recent timestamps", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30_000, now)).toBe("30s ago");
  });

  it("shows minutes once past 60 seconds", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("shows hours once past 60 minutes", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("shows days once past 24 hours", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/news/format-relative-time.test.ts`
Expected: FAIL — cannot find module `./format-relative-time`

- [ ] **Step 3: Implement `lib/news/format-relative-time.ts`**

```ts
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/news/format-relative-time.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write failing tests — `components/news/news-card.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsCard } from "./news-card";
import type { NewsArticle } from "@/lib/news/types";

const baseArticle: NewsArticle = {
  id: "https://example.com/a1",
  title: "Bitcoin Breaks $80,000",
  link: "https://example.com/a1",
  source: "CoinDesk",
  publishedAt: Date.now() - 60_000,
  summary: "Bitcoin surged past a key level today.",
  imageUrl: "https://example.com/img.jpg",
};

describe("NewsCard", () => {
  it("renders the title as a link to the original article, opening in a new tab", () => {
    render(<NewsCard article={baseArticle} />);
    const link = screen.getByRole("link", { name: "Bitcoin Breaks $80,000" });
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the source badge and summary text", () => {
    render(<NewsCard article={baseArticle} />);
    expect(screen.getByText("CoinDesk")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin surged past a key level today.")).toBeInTheDocument();
  });

  it("renders the thumbnail image when imageUrl is present", () => {
    render(<NewsCard article={baseArticle} />);
    expect(screen.getByRole("img", { name: "Bitcoin Breaks $80,000" })).toHaveAttribute(
      "src",
      "https://example.com/img.jpg"
    );
  });

  it("renders without an image element when imageUrl is null", () => {
    render(<NewsCard article={{ ...baseArticle, imageUrl: null }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run components/news/news-card.test.tsx`
Expected: FAIL — cannot find module `./news-card`

- [ ] **Step 7: Implement `components/news/news-card.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/news/format-relative-time";
import type { NewsArticle } from "@/lib/news/types";

export interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <Card>
      {article.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt={article.title}
          className="h-40 w-full rounded-t-lg object-cover"
        />
      )}
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Badge variant="neutral">{article.source}</Badge>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(article.publishedAt)}</span>
        </div>
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold hover:underline"
        >
          {article.title}
        </a>
        <p className="text-sm text-muted-foreground">{article.summary}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run components/news/news-card.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `components/ui/card.tsx` exports `Card`/`CardContent` (no header needed here, unlike other cards in this codebase — this card has no title/badge row split, it's a single flowing content block). If `CardContent`'s default padding conflicts visually with the thumbnail image needing to reach the card's edges, that's a manual/visual concern for Task 8's browser check, not a type error — proceed as written.

- [ ] **Step 10: Commit**

```bash
git add lib/news/format-relative-time.ts lib/news/format-relative-time.test.ts components/news/news-card.tsx components/news/news-card.test.tsx
git commit -m "feat: add news card component"
```

---

### Task 5: News page

Replaces Phase 1's `ComingSoon` placeholder at `/news`. Fetches once via `useNews`, holds local search/source-filter state, derives the filtered list client-side.

**Files:**
- Modify: `app/news/page.tsx` (currently `<ComingSoon title="News" />` from Phase 1)
- Create: `app/news/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/news/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { NewsArticle } from "@/lib/news/types";

const mockArticles: NewsArticle[] = [
  {
    id: "1",
    title: "Bitcoin Breaks $80,000",
    link: "https://example.com/1",
    source: "CoinDesk",
    publishedAt: Date.now(),
    summary: "Bitcoin surged today.",
    imageUrl: null,
  },
  {
    id: "2",
    title: "Ethereum Upgrade Ships",
    link: "https://example.com/2",
    source: "Decrypt",
    publishedAt: Date.now() - 1000,
    summary: "A major network upgrade went live.",
    imageUrl: null,
  },
];

vi.mock("@/lib/query/use-news", () => ({
  useNews: () => ({ data: mockArticles, isLoading: false, isStale: false }),
}));

import NewsPage from "./page";

describe("NewsPage", () => {
  it("renders every article by default", () => {
    render(<NewsPage />);
    expect(screen.getByText("Bitcoin Breaks $80,000")).toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("filters by search text across titles and summaries", () => {
    render(<NewsPage />);
    fireEvent.change(screen.getByPlaceholderText(/search news/i), { target: { value: "ethereum" } });
    expect(screen.queryByText("Bitcoin Breaks $80,000")).not.toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("filters by source when a source toggle is clicked off", () => {
    render(<NewsPage />);
    fireEvent.click(screen.getByRole("button", { name: "CoinDesk" }));
    expect(screen.queryByText("Bitcoin Breaks $80,000")).not.toBeInTheDocument();
    expect(screen.getByText("Ethereum Upgrade Ships")).toBeInTheDocument();
  });

  it("shows a no-results message when filters exclude everything", () => {
    render(<NewsPage />);
    fireEvent.change(screen.getByPlaceholderText(/search news/i), { target: { value: "nonexistent topic" } });
    expect(screen.getByText(/no articles match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/news/page.test.tsx`
Expected: FAIL — the current `ComingSoon` placeholder doesn't render any of this

- [ ] **Step 3: Replace `app/news/page.tsx`**

```tsx
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/news/page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full test suite and production build**

Run: `npx vitest run`
Expected: PASS — every test file from this plan plus everything from Phases 1-3 passes.

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/news/page.tsx app/news/page.test.tsx
git commit -m "feat: compose the news aggregator page"
```

---

### Task 6: Manual browser verification

Live RSS fetches, real image rendering, and whether the whole thing reads well as an actual news page can't be verified by the test suite. Mirrors every prior phase's final task.

**Files:** none (verification only; fix forward in the relevant task's files if something's broken)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running). Check for and stop any stale process already listening on port 3000 first (a prior phase in this project found a stale dev server silently causing a second instance to start on port 3001, producing misleading verification results).

- [ ] **Step 2: Open `/news` and confirm real articles render**

Navigate to `http://localhost:3000/news`. Confirm: the title/intro render, a loading skeleton appears briefly, then real, current articles appear from multiple sources (check a few headlines against the actual CoinDesk/Cointelegraph/Decrypt/The Block sites to confirm they're genuinely current, not stale/cached from hours ago beyond the 5-minute TTL). Confirm most cards show a thumbnail image (some may legitimately have none, per the parser's fallback chain) and that images actually load (not broken-image icons).

- [ ] **Step 3: Test search**

Type a term likely to appear in at least one current headline (e.g. "Bitcoin" or "ETF"). Confirm the grid narrows to matching articles only, and that clearing the search restores the full list.

- [ ] **Step 4: Test source filtering**

Click a source button to exclude it. Confirm that source's articles disappear and the button's visual state changes (outline vs. filled). Click it again to confirm articles reappear. Exclude all sources and confirm the "no articles match your filters" message appears.

- [ ] **Step 5: Test click-through**

Click an article's title. Confirm it opens the real article on the source's actual site in a new tab (not the same tab, not a 404).

- [ ] **Step 6: Check the browser console**

No uncaught errors during page load or filtering.

- [ ] **Step 7: Toggle light mode**

Confirm the page, cards, badges, and source-filter buttons all re-theme correctly with readable contrast in both themes.

- [ ] **Step 8: Test graceful degradation of a failed source**

Using browser devtools' network request blocking (or an equivalent), block requests to one of the four RSS feed domains, then reload `/news`. Confirm the page still renders articles from the other three sources rather than showing an error or a blank page — this directly verifies the resilience goal from the design spec.

- [ ] **Step 9: Fix forward if anything's broken**

If any check above fails, fix it in the relevant component/lib file, re-run that task's test file, and repeat this task's browser check before continuing.

- [ ] **Step 10: Stop the dev server and do a final commit if any fixes were made**

If Step 9 required changes:

```bash
git add -A
git commit -m "fix: address issues found in manual browser verification"
```

If no changes were needed, this task requires no commit.

---

## Plan Self-Review

**Spec coverage:** every section of the approved design spec
(`docs/superpowers/specs/2026-09-07-news-aggregator-design.md`) maps to
a task — the four fixed RSS sources and the confirmed image-tag
fallback chain (Task 1), the resilient merge-with-partial-failure
Route Handler mirroring Phase 1's caching pattern (Task 2), the
`useStaleAwareQuery`-based hook (Task 3), the card with thumbnail/
source badge/relative time/click-through (Task 4), the page composing
search + source filtering entirely client-side over an already-fetched
list (Task 5), and the manual verification of real live data, resilience,
and both themes (Task 6). The spec's non-goals (no full article reader,
no server-side persistence, no keyword category tagging, no
user-configurable source list) are respected — no task builds any of
these.

**Placeholder scan:** no TBD/TODO markers; every step has complete,
runnable code or an exact command with expected output. Task 1's
parser code and test fixtures are grounded in real, directly-inspected
feed output (documented inline) rather than guessed XML shapes, and
`fast-xml-parser`'s actual v5.11.1 parsed-object shape was verified
against real sample XML during planning (not assumed from
documentation) before any task code was written.

**Type consistency:** `NewsArticle` (Task 1's `lib/news/types.ts`) is
used identically by `parseRssFeed`'s return type (Task 1), the Route
Handler's cache and response shape (Task 2), `useNews`'s return type
(Task 3), and `NewsCard`'s props (Task 4). `NEWS_SOURCES` (Task 1) is
the single source of truth for the four feeds, reused unchanged by the
Route Handler (Task 2) and the page's source-filter buttons (Task 5) —
no source name/URL is duplicated or re-typed anywhere.
