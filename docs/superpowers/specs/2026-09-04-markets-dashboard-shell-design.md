# Markets Dashboard Shell — Design Spec

Date: 2026-09-04
Status: Approved
Phase: 1 of N (trading management platform)

## Context

The end goal is a full trading management platform: live markets dashboard,
strategy library with animated examples, a trade analyzer/journal (entry/TP/SL
evaluated against multiple strategies, PnL and risk sizing), a news/blog
aggregator, and an economic/crypto event calendar. That is too large for one
spec, so it is being built as a sequence of phases, each with its own design
doc and plan. This spec covers **Phase 1 only**: the app shell and markets
dashboard — the foundation every later phase plugs into.

Visual/UX reference: user-supplied screenshots of bitloom.online (dark navy
fintech theme, card-based panel layout, ticker strip, candlestick chart with
order book, Fear & Greed gauge, Sentiment/Leaders/Session/Global stat panels,
Recent Trades feed, footer link columns). No user accounts — bitloom's
sign-in/sign-up flow is explicitly excluded from this platform.

## Goals

- Recreate the dashboard layout and visual language from the reference
  screenshots, in both light and dark mode.
- Back every panel with real, live public market data — no API keys, no
  signup, no server-side secrets.
- Ship a navigation shell that the later phases (Strategies, Trade Analyzer,
  News, Calendar, Portfolio) can plug new routes into without rework.

## Non-goals (deferred to later phases/specs)

- Order entry / actual trading (Trade Desk).
- Portfolio tracking, PnL history.
- Strategy library content and animations.
- Trade analyzer / journal.
- News/blog aggregation.
- Economic/crypto calendar.
- Any authentication — this platform has none, ever.

## Architecture

- **Framework**: Next.js 14+ (App Router), TypeScript, Tailwind CSS,
  shadcn/ui for primitives (cards, tabs, buttons, tooltip, etc.).
- **Theming**: `next-themes`, class-based dark mode, toggle in the top nav,
  preference persisted to `localStorage`. Full light-mode palette designed
  alongside dark, not bolted on.
- **State**: a small Zustand store holds the currently-selected symbol,
  shared by the chart, order book, and recent-trades panels.
- **Data fetching**: TanStack Query for REST polling/caching (with
  `staleTime`/`refetchInterval` tuned per endpoint); a custom `useBinanceWs`
  hook manages WebSocket subscriptions (ticker, klines, depth, trades) with
  auto-reconnect and exponential backoff.
- **Charting**: `lightweight-charts` (TradingView's open-source library) for
  the candlestick chart, fed by REST klines on load and WS kline updates
  thereafter.

## Data sources (all free, no API key)

| Data | Source | Notes |
|---|---|---|
| Symbol prices, 24h stats | Binance REST `/api/v3/ticker/24hr` | Curated list of 10 pairs |
| Candlesticks | Binance REST `/api/v3/klines` + WS `kline` stream | Timeframes: 1m, 5m, 15m, 1h, 4h, 1D |
| Order book depth | Binance WS `depth` stream | Top ~15 bid/ask levels |
| Recent trades | Binance WS `trade` stream | Rolling last ~20 trades |
| Long/short ratio, open interest | Binance Futures REST `/futures/data/topLongShortAccountRatio`, `/fapi/v1/openInterest` | Feeds Sentiment/Session panels |
| Funding rate | Binance Futures REST `/fapi/v1/premiumIndex` | `lastFundingRate` for the matching USDT-margined perpetual |
| Fear & Greed Index | alternative.me `/fg/` | No key, updates daily |
| Global market cap, volume, BTC dominance | CoinGecko `/api/v3/global` | Routed through a Next.js route handler to avoid client rate-limit exposure |

Curated symbol list: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT,
AVAXUSDT, BNBUSDT, DOTUSDT, **PAXGUSDT** (labeled "Gold" — PAX Gold is a
real gold-backed token; Binance has no spot `XAUUSDT`, so this is the closest
real, tradable equivalent to the reference screenshot's gold pair).

## Layout / components

- **Top nav**: logo/wordmark, links (Markets / Trade Desk / Portfolio /
  Strategies / Analyzer / News / Company), search input, theme toggle. No
  sign-in/sign-up. Links to not-yet-built phases route to a small "coming in
  a later phase" placeholder page rather than a dead link.
- **Ticker strip**: horizontal scroll of the curated symbols with live price
  and 24h % change.
- **Markets list (left column)**: cards per symbol — name, price, 24h %
  change, volume. Clicking a card sets the selected symbol (Zustand),
  updating the chart, order book, and recent trades panels.
- **Chart panel (center)**: selected symbol header (price, 24h high/low/vol,
  funding rate), timeframe tabs, candlestick chart. Funding rate comes from
  Binance Futures REST `/fapi/v1/premiumIndex` (`lastFundingRate` for the
  matching USDT-margined perpetual) — spot prices/candles, futures funding,
  same symbol.
- **Order book + recent trades (right column)**: live bid/ask depth table,
  large current-price readout, rolling recent-trades list.
- **Stat panel row (bottom)**: Fear & Greed gauge, Sentiment (buy/sell %
  derived from long/short account ratio), Leaders (top gainers/losers from
  the curated list), Session (long/short ratio, OI change, basis, spread),
  Global (market cap, 24h volume, BTC dominance, open interest).
- **Footer**: static link columns (Platform / Support / Company / Legal)
  matching the reference layout; links into not-yet-built pages use the same
  placeholder pattern as the nav.

## Error handling

- WS disconnects trigger auto-reconnect with exponential backoff (capped);
  UI shows a small "reconnecting" indicator, not a crash.
- REST failures fall back to last-known-good cached data with a subtle
  "stale" badge rather than an empty/broken panel.
- Skeleton loading states for first paint on every panel.

## Testing

- Vitest + React Testing Library for pure logic: number/percent formatters,
  panel rendering against mocked API/WS payloads, symbol-selection state.
- WebSocket/live-data behavior isn't meaningfully unit-testable — verified
  by running the dev server and exercising it in a real browser (network
  tab + visual check that panels update live).

## Open questions / risks

- Binance public endpoints may be geo-blocked in some regions (notably the
  US) at the network level; if the deploy target turns out to be
  US-hosted, we may need to swap to `binance.us` or another provider for
  the affected endpoints. Not addressed in this phase — flagged for the
  deployment step.
- CoinGecko's public rate limit is modest; the route-handler proxy caches
  responses briefly (e.g. 60s) to stay well under it.
- `useBinanceDepth` (and the other WS hooks in `lib/binance/ws.ts`) open one
  independent WebSocket connection per call site, with no sharing/dedup
  across components. Found in Task 24 review: `OrderBookPanel` and
  `SessionPanel` both subscribe to the same symbol's depth stream
  independently, so the dashboard opens 2 live sockets to the identical
  Binance endpoint instead of 1. Low impact at current scale (one browser
  tab, one public unauthenticated endpoint), but would compound if more
  panels start sharing streams later (e.g. a watchlist). Deliberately not
  fixed as part of Phase 1 — `lib/binance/ws.ts` has already needed two
  rounds of lifecycle hardening, and reference-counted connection sharing
  is a real, TDD-worthy addition that deserves its own dedicated task
  rather than a rushed fix folded into a composition task. Revisit if/when
  connection count becomes a real problem or another panel needs to share
  a stream.
- Found via real-browser testing (Task 25), not the mocked unit suite:
  Binance's kline interval parameter is case-sensitive in a way that
  matters — `"1m"` (minute) and `"1M"` (month) are both valid, distinct
  values — so it can never be safely normalized with a blanket
  `.toLowerCase()`/`.toUpperCase()`. The dashboard's daily chart tab
  originally sent the UI label `"1D"` straight through and Binance
  silently rejected it. Fixed by exporting a `BinanceInterval` literal
  union from `lib/binance/rest.ts` and typing `fetchKlines`/
  `useBinanceKline`'s `interval` parameter with it, so any future call
  site gets a compile-time error instead of a runtime rejection the
  mocked tests can't see. Keep using `BinanceInterval` (not a bare
  `string`) for any new code that touches klines.
