# News Aggregator — Design Spec

Date: 2026-09-07
Status: Approved
Phase: 4 of N (trading management platform)

## Context

Phases 1-3 (markets dashboard, strategies library, trade analyzer) are
complete: a live dashboard, an educational strategy library, and a
live trade-analysis tool, all with no auth. This spec covers Phase 4:
a news aggregator replacing the `/news` placeholder from Phase 1's
`ComingSoon` page.

Per the original request, the platform should have "a news/blog
aggregator mirroring updates from another trading site." Before
designing, real candidate data sources were checked directly:

- `min-api.cryptocompare.com`'s news endpoint now requires an API key
  (401 without one) — no longer usable keyless.
- `cryptopanic.com`'s public posts endpoint returns 403 without a key.
- CoinDesk's RSS feed (`https://www.coindesk.com/arc/outboundfeeds/rss`,
  redirected from `/rss/`), CoinTelegraph's
  (`https://cointelegraph.com/rss`), Decrypt's
  (`https://decrypt.co/feed`), and The Block's
  (`https://www.theblock.co/rss.xml`) all returned HTTP 200 with real,
  current articles, no key or auth required.

RSS is therefore the data source, not a JSON news API.

## Goals

- Replace `/news` with a real page merging live articles from
  CoinDesk, CoinTelegraph, Decrypt, and The Block into one feed, sorted
  by publish time (newest first).
- Show each article's thumbnail (when the source feed provides one),
  headline, source, relative timestamp, and summary, linking out to
  the original article on the source site.
- Let the trader filter by source and search by headline/summary text.
- Resilience: if one feed is temporarily down or errors, the others
  still populate the page — a single dead feed must not blank the
  whole page.
- Keep the visual language consistent with Phases 1-3 (theme tokens,
  `Card`/`Badge` primitives, dark/light mode).

## Non-goals

- No full article content/reader view — RSS only provides a headline,
  summary, and a link to the original site; clicking an article opens
  it there (`target="_blank"`), it doesn't render inline.
- No server-side persistence of articles across restarts — the
  in-memory cache (below) is purely a rate-limiting/dedup measure
  within a running server process, matching Phase 1's
  `/api/global-stats` pattern. Nothing is stored in a database.
- No keyword-based category tagging (Bitcoin/DeFi/Regulation/etc.) —
  real feeds don't provide a consistent taxonomy across sources
  (confirmed by inspecting actual `<category>` tags: CoinDesk and The
  Block tag broadly and inconsistently, Decrypt's categories are often
  empty, CoinTelegraph doesn't nest into a fixed set), so heuristically
  guessing categories from keywords would mistag/mislabel constantly.
  Filtering by source (which the data actually and reliably supports)
  replaces this.
- No user-configurable source list (adding/removing feeds) — the four
  sources are fixed in this phase.

## Data source details (from direct inspection)

All four feeds are well-formed RSS 2.0 with `<title>`, `<link>`,
`<pubDate>`, `<description>` per `<item>`, but differ in how (or
whether) they embed an image, confirmed by inspecting real live feed
output:

- CoinDesk / The Block: `<media:content url="...">`.
- CoinTelegraph: `<media:content url="...">` AND `<enclosure url="...">`
  (redundant), plus an inline `<img>` inside the `<description>` CDATA.
- Decrypt: `<enclosure url="...">` AND `<media:thumbnail url="...">`.

No single tag works across all four, so the parser tries, in order:
`media:content` → `enclosure` → `media:thumbnail` → first `<img src>`
found inside the description HTML → no image (render a text-only
card).

Titles/descriptions are inconsistently CDATA-wrapped (some sources
wrap every field, Decrypt often doesn't) — the parser must handle both
plain text and CDATA-wrapped content transparently, which
`fast-xml-parser` (see Architecture) does natively.

## Architecture

- **`lib/news/sources.ts`** — `NEWS_SOURCES: { name: string; url: string }[]`,
  the four fixed feed URLs above, as the single source of truth for
  which feeds exist (used by both the route handler and its tests).
- **`lib/news/parse-rss.ts`** — `parseRssFeed(xml: string, sourceName: string): NewsArticle[]`,
  pure function using `fast-xml-parser` (new dependency — a small,
  widely-used XML-to-object parser; hand-rolled regex parsing was
  considered and rejected as too fragile against the real structural
  variety found above: CDATA vs. plain text, self-closing vs. paired
  tags, nested `media:content`). Normalizes each `<item>` into:
  ```ts
  interface NewsArticle {
    id: string;           // stable id derived from the article link
    title: string;
    link: string;
    source: string;       // "CoinDesk" | "Cointelegraph" | "Decrypt" | "The Block"
    publishedAt: number;  // ms since epoch, parsed from <pubDate>
    summary: string;      // <description>, HTML-stripped, truncated
    imageUrl: string | null;
  }
  ```
- **`app/api/news/route.ts`** — a Route Handler (mirroring Phase 1's
  `/api/global-stats` shape): fetches all 4 feeds in parallel via
  `Promise.allSettled` (a rejected/failed fetch for one source doesn't
  block the others), parses each successful response with
  `parseRssFeed`, merges all articles, sorts by `publishedAt` descending,
  caches the merged result in-memory for a short TTL (5 minutes,
  matching the general order of Phase 1's CoinGecko cache), and returns
  JSON. If a source's fetch/parse fails, it's simply omitted from the
  merged result — logged server-side, not surfaced as a user-facing
  error unless every source fails.
- **`lib/query/use-news.ts`** — `useNews(): StaleAwareResult<NewsArticle[]>`,
  a `useStaleAwareQuery`-based hook (Phase 1's established pattern)
  calling `/api/news`.
- **`components/news/news-card.tsx`** — `Card` showing the thumbnail
  (or nothing, laid out gracefully either way), a source `Badge`, the
  title (linking out via `<a target="_blank" rel="noopener noreferrer">`),
  a relative timestamp ("2h ago", computed from `publishedAt`), and the
  summary text.
- **`app/news/page.tsx`** — calls `useNews()` once; holds local
  `searchQuery: string` and `selectedSources: Set<string>` state;
  derives the filtered/searched article list via plain array
  `.filter()` (no re-fetch on filter/search changes, since everything
  is already loaded); renders a search input, per-source toggle
  buttons (using `NEWS_SOURCES` for the fixed list), and a responsive
  grid of `NewsCard`s, or a "no articles match" message when filters
  exclude everything.

## Data flow

Page loads → `useNews()` calls `/api/news` → Route Handler checks its
in-memory cache (serves cached merged articles if still fresh) or
fetches+parses+merges+caches fresh → client receives the full merged
list → all further interaction (search, source toggles) is pure
client-side filtering over that already-fetched list.

## Error handling

- All 4 feeds fail (e.g. total network outage): `/api/news` returns an
  empty array (not a 500) with a distinct signal the page can render as
  "news unavailable right now," matching Phase 1's stale/error UI
  conventions rather than a raw error page.
- Some feeds fail: merged result simply has fewer articles; no
  user-facing error, since the resilience goal is explicitly that a
  single dead feed doesn't blank the page.
- A malformed/unparseable item within an otherwise-successful feed:
  skip that one item (don't fail the whole feed over one bad entry).
- No articles match the current search/source filter: an explicit "no
  articles match your filters" message, not a blank grid.

## Testing

- `lib/news/parse-rss.test.ts` — unit tests using small hand-written
  sample XML strings (not live network calls) covering: a CoinDesk-style
  item (`media:content`, CDATA title), a CoinTelegraph-style item
  (`media:content` + `enclosure` + inline `<img>` in description — confirm
  `media:content` wins per the stated fallback order), a Decrypt-style
  item (`enclosure` + `media:thumbnail`, non-CDATA title), an item with
  no image tags at all but an inline `<img>` in its description (confirm
  the regex fallback fires), and an item with no image anywhere (confirm
  `imageUrl: null`, no crash).
- `app/api/news/route.test.ts` — mocks `fetch` per source URL; tests:
  all 4 succeed → merged + sorted by `publishedAt` descending; one
  source's fetch rejects → the other 3 still populate the response;
  all 4 fail → empty array returned, not a thrown error; a second
  request within the cache TTL doesn't re-fetch (asserted via mock
  call counts).
- `components/news/news-card.test.tsx` — renders with/without an
  `imageUrl`, confirms the title links to the real article URL with
  `target="_blank"` and `rel="noopener noreferrer"`, confirms the
  source badge text.
- `app/news/page.test.tsx` — mocks `useNews` to return a small fixed
  article list from multiple sources; tests: all render initially,
  typing in search narrows to matching titles/summaries, toggling a
  source off hides that source's articles, and the "no articles match"
  message appears when a search excludes everything.
- Manual browser verification (final task, mirroring every prior
  phase's last task): confirm real, current articles from all 4
  sources actually render with correct thumbnails/timestamps, confirm
  search and source filtering work against the real fetched data,
  confirm clicking an article opens the real source site in a new tab,
  confirm light/dark mode both render correctly, confirm the page
  degrades gracefully if a source is manually blocked (e.g. via browser
  devtools request blocking) rather than crashing.
