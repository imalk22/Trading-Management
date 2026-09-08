# Portfolio / Trade Desk — Design Spec

Date: 2026-09-08
Status: Approved
Phase: 6 of 6 (final phase, trading management platform)

## Context

Phases 1-5 (markets dashboard, strategies library, trade analyzer, news
aggregator, economic calendar) are complete: a live dashboard, an
educational strategy library, a live trade-analysis tool, a live news
aggregator, and a live economic calendar, all with no auth. This spec
covers Phase 6, the final phase: a trade journal and portfolio view,
fulfilling the original request's "PnL management and risk/heaps
calculation" requirement — the one remaining piece of the original ask.

Two placeholder routes already exist from Phase 1 with `ComingSoon`
pages: `/trade-desk` and `/portfolio` (both already in the nav). This
phase replaces both with real pages sharing one underlying trade
journal.

Since there is no backend database and no auth (established constraints
for the whole platform), all trade data is client-side, persisted to
`localStorage` via a Zustand store — the same pattern Phase 3 already
established and proved safe for SSR (`lib/analyzer/account-settings-store.ts`).

## Goals

- Let a trader manually log a trade (symbol, direction, entry price,
  optional stop-loss/take-profit, position size, notes) — there is no
  exchange integration, so trades are entered by hand, not imported.
- Show open positions on `/trade-desk` with live unrealized PnL (using
  Phase 1's Binance ticker fetching for current price), and let the
  trader close a position by entering an exit price.
- Show aggregate portfolio statistics on `/portfolio`: total realized
  PnL, total unrealized PnL, win rate, average risk:reward actually
  achieved on closed trades, and current open risk as a percentage of
  account balance — plus a history list of closed trades.
- Reuse Phase 3's account balance (`lib/analyzer/account-settings-store.ts`)
  for the open-risk-percentage calculation, rather than introducing a
  second, independent "account balance" concept that could drift out
  of sync with the Analyzer's.
- Keep the visual language consistent with Phases 1-5 (theme tokens,
  `Card`/`Badge` primitives, dark/light mode).

## Non-goals

- No exchange/broker integration — trades are always manually entered
  and manually closed, never auto-synced from a real account.
- No optional strategy tagging (linking a trade to one of Phase 2's 6
  strategies) or per-strategy win-rate breakdown — deliberately deferred
  to keep this final phase's scope tight; the `Trade` record's shape
  doesn't preclude adding a `strategyId` field later.
- No editing an existing trade's entry details after logging — a
  trader who made a data-entry mistake deletes the trade and re-logs
  it, rather than the app supporting in-place edits. This keeps the
  store's action surface small (`addTrade`, `closeTrade`, `deleteTrade`
  only).
- No multi-account or multi-portfolio support — one journal, one
  account balance, matching every other phase's "no auth, single
  implicit user" design.
- No CSV export/import or any persistence beyond `localStorage` — data
  lives in the browser it was entered in, consistent with every other
  piece of client-side state in this app (Phase 3's account settings
  have the same limitation).

## Data model

```ts
// lib/portfolio/types.ts
export type TradeDirection = "long" | "short";

export interface Trade {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  units: number;
  openedAt: number; // ms since epoch
  exitPrice: number | null; // null = still open
  closedAt: number | null; // null = still open
  notes: string;
}
```

Direction is an explicit field chosen when logging a trade, not
inferred from take-profit/stop-loss like the Trade Analyzer's
`inferDirection` — because stop-loss and take-profit are both optional
here (a trader may log a trade without a full plan), there isn't always
enough information to infer direction the way the Analyzer does with
three required prices.

## Architecture

- **`lib/portfolio/types.ts`** — `Trade`, `TradeDirection` as above.
- **`lib/portfolio/trade-store.ts`** — a Zustand store holding
  `trades: Trade[]`, persisted to `localStorage` under a dedicated key,
  following the exact same defaults-first-then-hydrate pattern as
  `lib/analyzer/account-settings-store.ts` (starts with an empty array
  on both server and first client render; a `hydrateTradesFromStorage()`
  function, called from a `useLayoutEffect` in the page, loads any
  previously saved trades post-hydration — avoiding the SSR/localStorage
  mismatch class of bug that pattern was designed to prevent). Actions:
  `addTrade(trade)`, `closeTrade(id, exitPrice, closedAt)`,
  `deleteTrade(id)`.
- **`lib/portfolio/calculations.ts`** — pure functions:
  - `computeTradePnl(trade, currentOrExitPrice)`: returns
    `{ pnlAmount: number; pnlPercent: number }`, computed as
    `(currentOrExitPrice - entryPrice) * units * (direction === "long" ? 1 : -1)`
    for the amount, and that amount divided by the position's notional
    value (`entryPrice * units`) for the percent. Works identically for
    an open trade (passed the live current price) and a closed trade
    (passed its stored `exitPrice`) — the caller decides which price to
    pass, this function doesn't know or care whether the trade is open.
  - `computePortfolioStats(trades, accountBalance)`: returns total
    realized PnL (sum of `computeTradePnl` over closed trades using
    each trade's `exitPrice`), total unrealized PnL (same, over open
    trades, using each trade's live current price — passed in as part
    of the input, this function doesn't fetch anything itself), win
    rate (percentage of closed trades with positive realized PnL — 0
    when there are no closed trades, not `NaN`), average risk:reward
    achieved (mean of `pnlAmount / (units * |entryPrice - stopLossPrice|)`
    over closed trades that HAD a `stopLossPrice` set — trades without
    one are excluded from this average since there's no defined risk to
    divide by, not treated as zero or skipped-with-a-warning), and
    current open risk as percent of account (sum over open trades with
    a `stopLossPrice` set of `units * |entryPrice - stopLossPrice|`,
    divided by `accountBalance`, times 100).
- **`lib/query/use-open-trade-prices.ts`** — a hook that takes the
  current list of open trades' unique symbols, fetches each via Phase
  1's `fetchTicker24hr`, and returns a `Record<symbol, currentPrice>`
  plus loading/stale state (via `useStaleAwareQuery`, matching every
  prior phase's data-fetching pattern).
- **`components/portfolio/trade-form.tsx`** — the log-a-trade form:
  symbol (reusing `CURATED_SYMBOLS` from `lib/symbols.ts`), a
  Long/Short toggle, entry price, optional stop-loss/take-profit,
  units, notes; calls `addTrade` on submit.
- **`components/portfolio/trade-row.tsx`** — renders one `Trade`. When
  `trade.closedAt === null` (open): shows live unrealized PnL (using a
  price passed in as a prop, sourced from `use-open-trade-prices` by
  the parent page) and a "Close" action that reveals an inline
  exit-price input, calling `closeTrade` on confirm. When
  `trade.closedAt !== null` (closed): shows the final realized PnL
  computed from the stored `exitPrice`, no close action. Both states
  show a delete action.
- **`components/portfolio/stats-summary.tsx`** — renders
  `computePortfolioStats`'s output as a stat grid (`Card`s matching
  Phase 1's stat-panel visual style).
- **`app/trade-desk/page.tsx`** — composes `TradeForm` + the list of
  open trades (via `TradeRow`), fetching live prices via
  `use-open-trade-prices` for the open trades' symbols.
- **`app/portfolio/page.tsx`** — composes `StatsSummary` (reading the
  account balance from `useAccountSettingsStore`, Phase 3's store) +
  the list of closed trades (via `TradeRow`, no live-price dependency
  since closed trades use their stored `exitPrice`).

## Data flow

Both pages read from the same `useTradeStore` (Zustand, no network
call for the trade data itself — it's all in `localStorage`/memory).
`/trade-desk` additionally calls `useOpenTradePrices` for live current
prices, needed only for open trades' unrealized PnL display.
`/portfolio` additionally reads `useAccountSettingsStore` for the
account balance used in the open-risk-percentage stat. Logging a trade,
closing a trade, or deleting a trade all synchronously update the
Zustand store (and its `localStorage` persistence), which both pages
re-render from immediately — no explicit refresh needed, matching how
Phase 3's account settings already behave.

## Error handling

- `useOpenTradePrices`'s fetch fails for a symbol: that trade's row
  shows its entry price with a "live price unavailable" note instead of
  a computed unrealized PnL, rather than blocking the whole Trade Desk
  page — mirroring Phase 1/3's established stale-data conventions. This
  never affects closed trades, which have no live-price dependency.
- Closing a trade with an invalid (non-numeric, empty) exit price:
  inline validation on the exit-price input, no store mutation until a
  valid number is entered.
- Deleting a trade: immediate, no confirmation dialog (matching the
  "no confirmation ceremony" simplicity of this app's other local-state
  mutations, e.g. Phase 3's account settings, which also apply
  immediately without a confirm step) — the low stakes of a
  client-only, single-user local journal don't warrant one.
- Zero trades logged yet: both pages show an empty-state message
  ("No trades logged yet." / "No closed trades yet.") rather than a
  blank list or a stats grid full of zeros/`NaN`.

## Testing

- `lib/portfolio/calculations.test.ts` — unit tests for
  `computeTradePnl` (long and short, profit and loss cases) and
  `computePortfolioStats` (win rate with zero closed trades → 0 not
  `NaN`; average R:R achieved correctly excluding trades with no
  stop-loss set; open-risk-percent correctly excluding open trades with
  no stop-loss set; realized vs. unrealized totals kept separate).
- `lib/portfolio/trade-store.test.ts` — mirrors
  `lib/analyzer/account-settings-store.test.ts`'s test shape:
  `addTrade`/`closeTrade`/`deleteTrade` mutate state and persist
  correctly, `hydrateTradesFromStorage` loads previously saved trades,
  malformed `localStorage` content is handled without a crash.
- `lib/query/use-open-trade-prices.test.tsx` — mocks `fetchTicker24hr`;
  tests fetching prices for multiple distinct symbols, and a failed
  fetch for one symbol not blocking prices for the others.
- `components/portfolio/trade-form.test.tsx` — submitting valid input
  calls `addTrade` with the right shape; direction toggle works;
  optional fields can be left empty.
- `components/portfolio/trade-row.test.tsx` — open-trade rendering
  (live PnL, Close action, delete), closed-trade rendering (final PnL,
  no Close action, delete), the inline close-with-exit-price
  interaction.
- `components/portfolio/stats-summary.test.tsx` — renders
  `computePortfolioStats`'s output correctly, including the zero-trades
  empty state.
- `app/trade-desk/page.test.tsx` / `app/portfolio/page.test.tsx` —
  composition tests mocking the store and price hook, matching every
  prior phase's page-test pattern.
- Manual browser verification (final task, mirroring every prior
  phase's last task): log a real trade, confirm it appears on
  `/trade-desk` with a real live unrealized PnL, close it with a
  realistic exit price, confirm it moves to `/portfolio`'s closed-trade
  list with correct realized PnL and updated aggregate stats, confirm
  trades persist across a page reload, confirm light/dark mode both
  render correctly, confirm the empty states render correctly for a
  freshly-cleared journal.
