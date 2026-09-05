# Strategies Library — Design Spec

Date: 2026-09-05
Status: Approved
Phase: 2 of N (trading management platform)

## Context

Phase 1 (markets dashboard shell) is complete: full live dashboard, no
auth, light/dark theming, app shell with placeholder routes for every
future phase. This spec covers Phase 2: an educational strategy library
replacing the `/strategies` placeholder from Phase 1's `ComingSoon` page.

Per the original request, the platform should teach a trader how common
strategies work, with an animated worked example for each — not just a
text description. This phase is purely educational content: no live
market data, no user positions, no backtesting against real history.

## Goals

- Replace `/strategies` with a real page grouping strategies by category.
- For each strategy: a plain-language explanation of the mechanics, and
  an animated chart demo showing entry, take-profit, and stop-loss on a
  representative (fabricated, not live) price move.
- Keep the visual language consistent with Phase 1 (same theme tokens,
  same `Card`/`Badge` primitives, dark/light mode both supported).

## Non-goals

- No live market data — sample candles are static, hand-authored data,
  not fetched from Binance or any API.
- No strategy backtesting against real historical data (that's a much
  larger feature; if wanted later, it belongs in the Trade Analyzer
  phase, not here).
- No user-created/custom strategies — this is a fixed, curated library.
- No linking strategies to the Trade Analyzer phase's suggestions yet
  (later phases may cross-reference, not this one).

## Content: the six strategies

Chosen to cover the categories a trader would expect from a strategies
section, matching common retail-trading education content:

1. **Moving Average Crossover** — Trend Following. A fast moving average
   crossing above a slower one signals a long entry; crossing below
   signals exit/short.
2. **RSI Mean Reversion** — Mean Reversion. Price dips into oversold RSI
   territory (< 30) then reverts upward; entry on the reversal, not the
   dip itself.
3. **Support/Resistance Breakout** — Breakout. Price consolidates in a
   range, then breaks above resistance with conviction; entry on the
   breakout candle close.
4. **Bollinger Band Squeeze** — Volatility Breakout. Bands narrow during
   low volatility, then price breaks out of a band as volatility
   expands; entry in the direction of the breakout.
5. **MACD Momentum Cross** — Momentum. The MACD line crossing above its
   signal line signals building upward momentum; entry on the cross.
6. **Head & Shoulders Reversal** — Chart Pattern. A classic three-peak
   reversal pattern (left shoulder, higher head, right shoulder) that
   signals an uptrend running out of steam; entry on the neckline break.

Each strategy record includes: id, name, category, a 2-4 sentence
plain-language description, and a hand-authored sequence of OHLC candles
long enough to show the setup forming and the trade playing out (roughly
40-60 candles), plus the index of the entry candle, the entry side
(long/short), and the indices/prices of the take-profit and stop-loss
levels.

## Architecture

- **Data**: `lib/strategies/data.ts` exports `STRATEGIES: Strategy[]`, a
  plain static array (no fetching, no state) — each entry containing the
  fields above. Categories are derived from the data, not a separate
  enum needing to stay in sync.
- **Demo animation**: `components/strategies/strategy-demo-chart.tsx`
  wraps `lightweight-charts` (already a Phase 1 dependency). On mount, it
  creates a candlestick series with zero data, then on an interval feeds
  one additional candle at a time via `series.update()`. Once the
  animation reaches the entry index, it calls `series.setMarkers()` to
  place an entry arrow; at the TP/SL indices it adds exit markers and
  draws a horizontal price line for each level. After reaching the end
  of the data, it pauses briefly, clears the series, and restarts the
  reveal from the beginning — a continuous, silent, looping demo with no
  user controls needed (matching "example animation" from the request,
  not an interactive backtester).
- **Presentation**: `components/strategies/strategy-card.tsx` renders a
  `Card` with the strategy name, a category `Badge`, the description,
  and the `StrategyDemoChart` beneath it.
- **Page**: `app/strategies/page.tsx` groups `STRATEGIES` by category
  (using `Object.groupBy`-style reduction) and renders a heading per
  category followed by its `StrategyCard`s in a responsive grid.

## Data flow

Entirely static and client-side. No `useStaleAwareQuery`, no route
handlers, no external calls. The only "dynamic" behavior is the demo
animation's own internal `setInterval`-driven state, which lives inside
`StrategyDemoChart` and never leaves that component.

## Error handling

None needed in the network/data sense (nothing can fail to load — the
data ships in the JS bundle). The only defensive concern is chart
cleanup: like Phase 1's `CandlestickChart`, `StrategyDemoChart` must
clear its `setInterval` and call `chart.remove()` on unmount, mirroring
the lifecycle care already established for `lightweight-charts` usage in
Phase 1 (that file went through two rounds of bug fixes for exactly this
class of issue — stale timers/closures acting after teardown).

## Testing

- Unit tests for `lib/strategies/data.ts`: validate every strategy's
  invariants (entry index is within the candle array bounds, take-profit
  and stop-loss indices come after the entry index, at least one
  strategy exists per stated category, all 6 categories are represented
  exactly as listed above).
- `StrategyDemoChart` tests mock `lightweight-charts` the same way
  Phase 1's `CandlestickChart` did — assert that `setData`/`update` is
  called with the right candle sequence shape and that `setMarkers` is
  eventually called with an entry marker, without testing real animation
  timing (use fake timers to advance the interval deterministically
  instead of relying on wall-clock waits).
- `StrategyCard`/page-level tests render with real (non-mocked) data
  from `lib/strategies/data.ts` and assert the name/category/description
  render, with `StrategyDemoChart` itself mocked out (same shallow-mock
  pattern as Phase 1's dashboard-page composition test).

## Sample data generation

Hand-typing 6 sets of 40-60 realistic-looking OHLC candles would be
tedious and easy to get subtly wrong (e.g. a "breakout" that doesn't
visually read as a breakout once rendered). Instead, `lib/strategies/`
includes a small deterministic candle generator (seeded, not `Math.random`,
so tests and the demo are reproducible): a base random-walk function
parameterized by drift/volatility, plus per-pattern shape functions that
bias the walk to actually produce the intended shape — e.g. the
crossover strategy's generator drifts gently up throughout with a fast
short-window average recomputed over the generated closes; the breakout
generator holds price in a tight band for the first ~70% of candles then
adds a sustained upward drift for the remainder; the head-and-shoulders
generator explicitly places three local peaks (mid, higher, mid) via
piecewise drift changes rather than relying on randomness to produce the
shape by chance. Each strategy's entry/TP/SL indices and prices are then
derived from the generated series (e.g. "the candle where the fast MA
crosses the slow MA" is computed after generation, not hand-picked),
guaranteeing the invariants the unit tests check are satisfied by
construction rather than by manual bookkeeping.
