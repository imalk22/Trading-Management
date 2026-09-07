# Economic Calendar — Design Spec

Date: 2026-09-08
Status: Approved
Phase: 5 of N (trading management platform)

## Context

Phases 1-4 (markets dashboard, strategies library, trade analyzer, news
aggregator) are complete: a live dashboard, an educational strategy
library, a live trade-analysis tool, and a live news aggregator, all
with no auth. This spec covers Phase 5: a calendar page replacing the
`/calendar`-adjacent gap in the original request's "markets dashboard
with sentiment/session/leaders/volume-leaders/exchange-flows/
calendars" feature list — the one named feature Phase 1 didn't build.

Before designing, real candidate data sources were checked directly:

- `api.tradingeconomics.com`'s guest/free tier has been discontinued
  (confirmed via direct request — returns an explicit deprecation
  message).
- `coinmarketcal.com` (the natural crypto-specific events source)
  returns HTTP 403 on unauthenticated requests, even with a
  browser-like User-Agent.
- `https://nfs.faireconomy.media/ff_calendar_thisweek.json` (a
  well-known unofficial ForexFactory calendar mirror used by many
  existing trading tools) returned HTTP 200 with real, current,
  well-structured event data, no key or auth required. Verified live:
  events include `title`, `country` (currency), `date` (ISO 8601 with
  a fixed `-04:00` offset), `impact` (confirmed values: `"Low"`,
  `"Medium"`, `"High"`, `"Holiday"`), `forecast`, `previous`. No
  `Access-Control-Allow-Origin` header, so it can't be fetched directly
  from the browser — needs a server-side proxy, same as every other
  external data source in this codebase. No "next week" variant exists
  for free (`ff_calendar_nextweek.json` returns 404) — only the current
  week's data is available.

No free, keyless source exists for crypto-specific events (token
unlocks, exchange listings, protocol launch dates), and this spec does
not fabricate any such data — presenting invented dates as real
information on a trading tool would be actively misleading. The one
exception, explicitly approved: a tiny, hardcoded list of
protocol-fixed milestones whose dates are mathematically/algorithmically
determined and don't need external verification — specifically, the
Bitcoin halving (occurs every 210,000 blocks; the next halving is at
block 1,050,000, calculated at roughly April 2028 given Bitcoin's
~10-minute average block time — this is public, verifiable knowledge
about Bitcoin's protocol, not a claim about any external event
schedule).

## Goals

- Replace `/calendar` with a real page showing this week's live
  macro-economic events (Fed decisions, CPI releases, jobs reports,
  central bank rate decisions, etc.), grouped by day, in the viewer's
  local time.
- Show a small, static "Crypto Milestones" section with the Bitcoin
  halving countdown — the only crypto-specific content in this phase,
  chosen specifically because it needs no live data source to be
  accurate.
- Let the trader filter by impact level — defaulting to Medium+High
  only (the events that actually move markets), with a toggle to reveal
  Low-impact and Holiday entries.
- Keep the visual language consistent with Phases 1-4 (theme tokens,
  `Card`/`Badge` primitives, dark/light mode).

## Non-goals

- No crypto-specific event data beyond the Bitcoin halving — no token
  unlocks, exchange listings, or protocol launch dates, since no
  free/keyless source exists and fabricating dates is out of scope by
  design, not an oversight.
- No "next week" or historical/past-week view — the free data source
  only provides the current week; this phase shows what's available
  and doesn't attempt to work around that limitation (e.g., no
  scraping, no paid API integration).
- No full month-grid calendar widget — an agenda list grouped by day
  matches the data's actual shape (a bounded one-week list) far better
  than a mostly-empty month grid would, and is meaningfully simpler to
  build and test correctly.
- No user-configurable currency/country filtering — impact-level
  filtering (Medium+High vs. all) is the only filter in this phase;
  per-currency filtering could be added later if wanted, but isn't
  needed to make the page useful.

## Architecture

- **`lib/calendar/types.ts`** — `EconomicEvent { id: string; title: string; country: string; date: string; impact: "Low" | "Medium" | "High" | "Holiday"; forecast: string; previous: string }`
  (`date` stored as an ISO string, since the source already provides a
  fixed offset — converted to the viewer's local time only at display
  time, not at storage time, keeping the stored value
  timezone-unambiguous).
- **`lib/calendar/crypto-milestones.ts`** — `CRYPTO_MILESTONES: { id: string; title: string; date: string; description: string }[]`,
  a hardcoded array containing exactly one entry (the Bitcoin halving),
  with a description noting the date is an estimate based on average
  block time (protocol-fixed by block height, not by calendar date, so
  the exact day can shift by real block-time variance).
- **`app/api/calendar/route.ts`** — a Route Handler (mirroring
  `app/api/global-stats/route.ts` and `app/api/news/route.ts`'s
  established shape): fetches
  `https://nfs.faireconomy.media/ff_calendar_thisweek.json` server-side,
  normalizes the raw JSON array into `EconomicEvent[]` (deriving a
  stable `id` from title+date+country, since the source provides no
  id field), caches the result in-memory for a few minutes, and returns
  it as JSON. If the fetch fails, returns an empty array with a 200
  status (matching Phase 4's "never let a failed upstream produce a
  500 or block rendering" convention) — the client distinguishes "no
  data available" from "filtered to zero" the same way Phase 4's news
  page does.
- **`lib/calendar/group-by-day.ts`** — `groupEventsByLocalDay(events: EconomicEvent[]): { dateKey: string; events: EconomicEvent[] }[]`,
  a pure function that converts each event's ISO timestamp to the
  browser's local calendar day (via `Date` and local-timezone date
  formatting, not the feed's fixed `-04:00` offset), groups events by
  that local day, and returns groups sorted chronologically with each
  group's events also sorted chronologically. This is the riskiest
  piece of logic in the plan — a trader in, say, Sri Lanka (UTC+5:30)
  viewing an event timestamped `2026-09-07T21:30:00-04:00` should see
  it grouped under their own local Sept 8, not the feed's Sept 7,
  since the actual moment in time (which is what matters for "when
  does this happen relative to my day") crosses the local midnight
  boundary relative to the US-Eastern-anchored feed.
- **`lib/query/use-calendar.ts`** — `useCalendar(): StaleAwareResult<EconomicEvent[]>`,
  a `useStaleAwareQuery`-based hook calling `/api/calendar`, matching
  every prior phase's data-fetching hook pattern.
- **`components/calendar/event-row.tsx`** — one event: its local time
  (e.g. "8:30 AM"), title, a currency `Badge` (`neutral` variant), an
  impact `Badge` (`"High"` → `down` variant, drawing attention; all
  others → `neutral` — reusing the existing 3-variant `Badge` rather
  than adding a new variant, since severity and price-direction are
  different concepts but the existing red/neutral vocabulary reads
  fine for "important vs. routine"), and forecast/previous values when
  present.
- **`app/calendar/page.tsx`** — composes: a static "Crypto Milestones"
  `Card` (rendering `CRYPTO_MILESTONES`, no network dependency), an
  impact-level filter control (default: Medium+High only; a toggle
  reveals Low/Holiday), and the day-grouped agenda list built from
  `useCalendar()` + `groupEventsByLocalDay()`, with loading/empty/
  unavailable states following Phase 4's established conventions.

## Data flow

Page loads → `useCalendar()` calls `/api/calendar` → Route Handler
checks its in-memory cache (serves cached data if fresh) or
fetches+normalizes+caches fresh from the real feed → client receives
the full week's events → impact filtering and day-grouping happen
entirely client-side over that already-fetched list (no re-fetch per
filter toggle, consistent with Phase 4's news page).

## Error handling

- The upstream feed fails or is unreachable: `/api/calendar` returns
  `{ events: [] }` with HTTP 200 (never a 500, matching the resilience
  convention established in Phase 4's news route) — client shows a
  distinct "Economic calendar data is unavailable right now." message,
  while the static Crypto Milestones card still renders regardless
  (it has no fetch dependency).
- The impact filter excludes every event that exists: shows a distinct
  "No events match the current filter." message (mirroring Phase 4's
  "no data" vs. "filtered to zero" distinction) rather than reusing the
  "unavailable" message.
- A malformed individual event in the feed (missing/unparseable date):
  skip that one event rather than failing the whole response, mirroring
  Phase 4's per-item resilience in `parseRssFeed`.

## Testing

- `lib/calendar/group-by-day.test.ts` — unit tests for the
  local-day-grouping logic, specifically including a timezone-boundary
  case (an event whose fixed-offset UTC instant falls on one calendar
  date in `-04:00` but a different calendar date in another timezone,
  confirming grouping follows the actual instant converted to local
  time, not the feed's raw date string) and a chronological-sort check
  both across groups and within a single group.
- `app/api/calendar/route.test.ts` — mocks `fetch`; tests: successful
  fetch normalizes and returns events; a fetch failure returns
  `{ events: [] }` with HTTP 200, not an error; a malformed individual
  event (bad `date`) is skipped without failing the rest; caching
  behavior (a second call within the TTL doesn't re-fetch), mirroring
  `app/api/news/route.test.ts`'s test shape.
- `components/calendar/event-row.test.tsx` — renders with a `"High"`
  impact event and confirms the `down`-variant badge; renders with
  `"Low"`/`"Medium"`/`"Holiday"` and confirms the `neutral` variant;
  confirms the local time, title, and currency badge render.
- `app/calendar/page.test.tsx` — mocks `useCalendar`; tests: events
  render grouped under day headings; the impact filter defaults to
  Medium+High only; toggling the filter reveals Low/Holiday events; the
  Crypto Milestones card renders regardless of `useCalendar`'s state
  (including when it returns no data); the "unavailable" vs. "no
  events match filter" messages each appear in their correct scenario.
- Manual browser verification (final task, mirroring every prior
  phase's last task): confirm real, current events render grouped by
  the correct local day, confirm the impact filter default and toggle
  work against real data, confirm the Bitcoin halving milestone renders
  correctly, confirm light/dark mode both render correctly, confirm the
  page degrades gracefully if the feed is unreachable.
