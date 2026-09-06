# Trade Analyzer — Design Spec

Date: 2026-09-06
Status: Approved
Phase: 3 of N (trading management platform)

## Context

Phase 1 (markets dashboard shell) and Phase 2 (strategies library) are
complete: a live dashboard with no auth, light/dark theming, and an
educational strategies library with six curated strategies, each with an
animated demo showing entry/take-profit/stop-loss on a synthetic price
series (`lib/strategies/`). This spec covers Phase 3: a Trade Analyzer
that lets a trader evaluate a proposed real trade — replacing the
`/analyzer` placeholder from Phase 1's `ComingSoon` page.

Per the original request, the platform should help a trader analyze a
trade idea (entry/take-profit/stop-loss) against multiple strategies, and
provide risk/position-size ("heaps") calculation and PnL-relevant math.
This phase covers the analysis tool itself; a full trade journal/PnL
ledger across multiple trades is a later phase (Portfolio/Trade Desk),
not this one.

## Goals

- A one-shot calculator: a trader enters a proposed trade and account
  risk settings, and immediately sees its risk:reward ratio, a
  recommended position size, and max loss/gain in $ and % of account.
- Show the current live price for the selected symbol as context (e.g.
  "entry is 2.3% above current price"), reusing Phase 1's Binance REST
  helpers.
- Run a **live strategy alignment check**: for the selected symbol, fetch
  real recent candles and run each of Phase 2's six strategies' actual
  entry-detection logic against them, showing which strategies'
  conditions are genuinely true right now (not a static/textual
  comparison).
- Persist account balance and default risk-per-trade % locally (no
  accounts/sign-in) so the trader doesn't re-enter them every visit.
- Keep the visual language consistent with Phases 1-2 (theme tokens,
  `Card`/`Badge` primitives, dark/light mode).

## Non-goals

- No trade history/journal — nothing about a specific analyzed trade is
  saved. Only account balance/risk % persist. A full trade log with
  running PnL belongs to the later Portfolio/Trade Desk phase.
- No order execution or exchange account integration — purely
  analytical.
- No user accounts/sign-in, matching every prior phase.
- No changes to `computeTrade`'s existing behavior or its callers in
  Phase 2 — the Analyzer computes R:R/position-size independently from
  the trader's own entry/TP/SL, it does not reuse `computeTrade` (which
  exists to *derive* TP/SL from a swing point for synthetic demo data, a
  different purpose than analyzing trader-supplied levels).

## Inputs

- **Symbol** — dropdown sourced from `lib/symbols.ts`'s `CURATED_SYMBOLS`
  (same list Phase 1 uses elsewhere), default `DEFAULT_SYMBOL`.
- **Entry price, take-profit price, stop-loss price** — trader-supplied
  numbers.
- **Direction is inferred, not asked.** If `takeProfit > entry` and
  `stopLoss < entry`, the trade is long. If `takeProfit < entry` and
  `stopLoss > entry`, the trade is short. Any other combination (e.g.
  both TP and SL on the same side of entry, or either equal to entry) is
  an invalid/contradictory setup: show a validation message and skip
  calculation rather than guessing a direction.
- **Account balance** and **risk per trade (%)** — entered once, saved to
  `localStorage`, pre-filled on return visits, editable anytime via the
  same form.

## Calculations (`lib/analyzer/calculations.ts`)

All pure functions, no React/DOM dependency, framework-agnostic and unit
tested directly.

- `inferDirection(entry, takeProfit, stopLoss): "long" | "short" | "invalid"`
- `computeRiskReward(entry, takeProfit, stopLoss, direction): number` —
  reward distance ÷ risk distance.
- `computePositionSize(accountBalance, riskPercent, entry, stopLoss): { units: number; notionalValue: number }` —
  `riskAmount = accountBalance * (riskPercent / 100)`;
  `riskPerUnit = Math.abs(entry - stopLoss)`;
  `units = riskAmount / riskPerUnit`; `notionalValue = units * entry`.
- `computeMaxLossGain(units, entry, takeProfit, stopLoss): { maxLossAmount, maxLossPercent, maxGainAmount, maxGainPercent }` —
  dollar and percent-of-account figures at the full position size.
- Edge cases explicitly handled: `riskPerUnit === 0` (entry equals
  stop-loss) returns `Infinity`/a clear "invalid: zero risk distance"
  signal rather than throwing or producing `NaN` silently; `accountBalance <= 0`
  or `riskPercent <= 0` are treated as invalid input by the form layer
  before these functions are ever called (validated at the input
  boundary, consistent with the rest of the codebase's "no defensive
  handling for states the UI already prevents" approach).

## Live strategy alignment

This is the core new capability and the reason for touching Phase 2.

**Refactor `lib/strategies/data.ts`:** each of the six `build*()`
functions currently inlines its own "scan for the entry signal" loop
(e.g. the SMA-crossover comparison, the RSI oversold-then-recovery state
machine). Extract each into its own pure function in a new
`lib/strategies/detectors.ts`:

```ts
export interface DetectionResult {
  aligned: boolean;
  reason: string;
}

export function detectMovingAverageCrossover(closes: number[], i: number): DetectionResult;
export function detectRsiMeanReversion(closes: number[], i: number, wasOversold: boolean): DetectionResult;
export function detectSupportResistanceBreakout(candles: GeneratedCandle[], i: number, resistance: number): DetectionResult;
export function detectBollingerSqueeze(candles: GeneratedCandle[], i: number, middle: number, width: number): DetectionResult;
export function detectMacdMomentumCross(macdLine: (number | undefined)[], signalLine: (number | undefined)[], i: number): DetectionResult;
export function detectHeadAndShoulders(candles: GeneratedCandle[], i: number, necklinePrice: number): DetectionResult;
```

(Exact signatures to be finalized during planning — each detector takes
whatever pre-computed series/thresholds its strategy already needs, plus
the index to check, so the caller controls what data feeds it.)

`data.ts`'s `build*()` functions are refactored to call these detectors
inside their existing scan loops instead of inlining the comparison —
**behavior-preserving**: the six strategies' existing entry indices,
prices, and all 117 existing Phase 1+2 tests must continue to pass
unchanged. This refactor is verified via the existing test suite before
any Phase 3 code is written on top of it.

`RsiMeanReversion` and `HeadAndShoulders`/others with multi-step state
(the "was oversold, now recovering" flag; the precomputed neckline) keep
that stateful bookkeeping in the caller (`build*()` in Phase 2, and the
new live-analysis code in Phase 3) — the detector functions themselves
stay pure and stateless per call, taking whatever state they need as
parameters rather than holding it internally.

**Phase 3's live analysis (`lib/analyzer/live-strategy-check.ts`):**
given a symbol, fetches recent candles via `fetchKlines` (reusing Phase
1's `lib/binance/rest.ts`, e.g. 200 candles at a 1h interval — exact
interval/count finalized during planning based on what gives each
detector enough lookback), computes whatever indicator series each
detector needs (SMA/EMA/RSI/rolling stdev from `lib/strategies/indicators.ts`,
already shared), and runs all six detectors against the latest available
index. Returns one `{ strategyId, name, category, aligned, reason }` per
strategy.

**Direction filtering:** a strategy whose `entryType` doesn't match the
trader's inferred trade direction is shown as **N/A** (not checked, not
"not aligned") with a reason like "long setup — this pattern is short-only."
Only same-direction strategies are actually evaluated as
Aligned/Not Yet.

## Architecture

- `lib/strategies/detectors.ts` — six extracted pure detector functions
  (new file; Phase 2 refactor).
- `lib/analyzer/calculations.ts` — R:R, position sizing, max loss/gain
  (new, pure, Phase 3).
- `lib/analyzer/live-strategy-check.ts` — fetches candles, runs all six
  detectors, returns alignment results (new, Phase 3).
- `lib/analyzer/account-settings-store.ts` — small store for
  balance/risk% persisted to `localStorage`, following the same
  shape/pattern as `lib/store/symbol-store.ts` (new, Phase 3).
- `components/analyzer/trade-input-form.tsx` — symbol picker,
  entry/TP/SL fields, account balance/risk% fields, inline validation.
- `components/analyzer/trade-summary-panel.tsx` — R:R, position size,
  max loss/gain, live-price comparison (`Card` layout, reusing Phase 1's
  number-formatting helpers from `lib/format.ts`).
- `components/analyzer/strategy-alignment-panel.tsx` — six-row checklist,
  one `Badge` per strategy (`aligned` / `not yet` / `n/a` variants),
  reason text beneath each.
- `app/analyzer/page.tsx` — composes the above, replacing Phase 1's
  `ComingSoon` placeholder.

## Data flow

Form input is local component/page state (a plain `useState`/reducer —
no need for global state beyond the persisted account settings, which
load once on mount from `account-settings-store.ts` and save on every
edit). On a valid trade setup, the page derives R:R/position-size/max-
loss-gain synchronously via the pure `calculations.ts` functions (no
network dependency), and separately triggers a Binance kline fetch
(via a `useStaleAwareQuery`-style hook, matching Phase 1's established
pattern) to get the live price and run the strategy-alignment check.
These two data paths are independent: the trade math always renders
immediately regardless of network state; the live-price/alignment panel
has its own loading/error/stale states layered on top.

## Error handling

- Contradictory entry/TP/SL (see `inferDirection`): inline validation
  message on the form, no calculation section rendered at all.
- Zero risk distance (entry equals stop-loss): a distinct validation
  message ("stop-loss cannot equal entry price"), not a silent
  `Infinity`/`NaN` render.
- Binance fetch failure or symbol with insufficient candle history:
  the trade-math summary panel still renders fully (it has no network
  dependency); the live-price context and strategy-alignment panel show
  a "live data unavailable" state, mirroring Phase 1's established
  stale-badge/error patterns (Phase 1's `StaleBadge`, or the
  loading/settled-no-data branching already used in the stat panels).

## Testing

- `lib/strategies/detectors.test.ts` — new tests for the six extracted
  detector functions in isolation (given a small hand-built candle/series
  fixture, assert `aligned`/`reason` for both a true-positive and a
  true-negative case per strategy).
- `lib/strategies/data.test.ts` — existing tests continue to pass
  unchanged after the refactor (regression guard — this is the main
  evidence the extraction was behavior-preserving).
- `lib/analyzer/calculations.test.ts` — unit tests for
  `inferDirection`/`computeRiskReward`/`computePositionSize`/
  `computeMaxLossGain`, covering both long and short trades and the
  zero-risk-distance and contradictory-input edge cases.
- `lib/analyzer/live-strategy-check.test.ts` — mocks `fetchKlines`
  (same mocking pattern Phase 1 used for Binance REST calls) and asserts
  the six detectors are invoked with correctly-shaped derived series and
  that direction-mismatched strategies are correctly marked N/A.
- Component tests for `trade-input-form`, `trade-summary-panel`, and
  `strategy-alignment-panel` render with representative fixtures,
  mocking `live-strategy-check` at the boundary (same shallow-mock
  pattern as Phase 2's `StrategyCard` test).
- `app/analyzer/page.test.tsx` mocks the above components/data hooks and
  asserts they're all composed and wired to the same form state, matching
  Phase 2's page-composition test pattern.
- Manual browser verification (final task, mirroring Phase 1's Task 25
  and Phase 2's Task 8): enter a real trade for a real symbol, confirm
  the math is sane, confirm the live strategy panel reflects real
  current market conditions (cross-checked by eye against a live chart),
  confirm light/dark mode both render correctly, confirm account
  settings persist across a page reload.
