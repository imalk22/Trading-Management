# Markets Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js app shell and live markets dashboard (nav, theme toggle, ticker strip, markets list, candlestick chart, order book, recent trades, Fear & Greed / Sentiment / Leaders / Session / Global stat panels, footer) backed by free public APIs (Binance, alternative.me, CoinGecko), matching the reference screenshots in both light and dark mode.

**Architecture:** Next.js 14 App Router + TypeScript + Tailwind, hand-written shadcn-style primitives (no CLI dependency), Zustand for selected-symbol state, TanStack Query for REST caching/stale-fallback, a custom WebSocket manager with reconnect/backoff for live ticker/kline/depth/trade streams, `lightweight-charts` for the candlestick chart, `next-themes` for light/dark.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Zustand, @tanstack/react-query, lightweight-charts, next-themes, class-variance-authority, clsx, tailwind-merge, Vitest, @testing-library/react.

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, tailwind.config.ts, vitest.config.ts, vitest.setup.ts
app/
  layout.tsx                          - ThemeProvider + QueryProvider + TopNav + Footer
  globals.css                         - Tailwind layers + light/dark CSS variables
  page.tsx                            - Markets dashboard page composition
  trade-desk/page.tsx                 - ComingSoon("Trade Desk")
  portfolio/page.tsx                  - ComingSoon("Portfolio")
  strategies/page.tsx                 - ComingSoon("Strategies")
  analyzer/page.tsx                   - ComingSoon("Analyzer")
  news/page.tsx                       - ComingSoon("News")
  company/page.tsx                    - ComingSoon("Company")
  api/global-stats/route.ts           - proxies CoinGecko /global, cached
components/
  ui/button.tsx, card.tsx, tabs.tsx, badge.tsx, skeleton.tsx
  layout/top-nav.tsx, theme-toggle.tsx, footer.tsx, coming-soon.tsx
  markets/ticker-strip.tsx, market-card.tsx, markets-list.tsx, chart-panel.tsx,
          order-book-panel.tsx, recent-trades-panel.tsx, stale-badge.tsx
  markets/stat-panels/fear-greed-panel.tsx, sentiment-panel.tsx, leaders-panel.tsx,
          session-panel.tsx, global-panel.tsx
lib/
  utils.ts                            - cn() class merge helper
  format.ts                           - price/percent/compact-number formatters
  symbols.ts                          - curated symbol list
  store/symbol-store.ts               - Zustand selected-symbol store
  query/query-provider.tsx            - QueryClientProvider
  query/use-stale-query.ts            - useQuery wrapper exposing isStale-due-to-error
  binance/rest.ts                     - REST fetchers (ticker24hr, klines, premiumIndex, longShortRatio, openInterest)
  binance/ws.ts                       - WebSocket manager + hooks (useBinanceTicker, useBinanceKline, useBinanceDepth, useBinanceTrades)
  external/fear-greed.ts              - alternative.me fetcher
  external/coingecko.ts               - client for /api/global-stats
```

Each `components/**/*.tsx` file that renders data has a colocated `*.test.tsx`; each `lib/**/*.ts` file with logic has a colocated `*.test.ts`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

- [ ] **Step 1: Init package.json and install core deps**

```bash
npm init -y
npm install next@^15.0.0 react@^18.3.0 react-dom@^18.3.0
npm install -D typescript@^5.5.0 @types/node@^20 @types/react@^18 @types/react-dom@^18
npm install -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0
```

(Note: originally pinned to `next@^14.2.0`, but Next.js 14 rejects TypeScript config files outright — `next.config.ts` requires Next 15+. Bumped to 15 to keep the `.ts` config from Step 4. Nothing else in this plan depends on Next 14-only or Next 15-only behavior — no dynamic route `params`, no `cookies()`/`headers()` usage anywhere — so this is a version-only change.)

- [ ] **Step 2: Write `.gitignore`**

```
node_modules
.next
out
.env*.local
coverage
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Write `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Write `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        up: "hsl(var(--up))",
        down: "hsl(var(--down))",
      },
      borderRadius: {
        lg: "var(--radius)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 7: Write `postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 8: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 210 40% 98%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --border: 214 32% 91%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --primary: 199 89% 48%;
  --primary-foreground: 210 40% 98%;
  --up: 152 60% 40%;
  --down: 0 72% 51%;
  --radius: 0.75rem;
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 98%;
  --card: 222 44% 9%;
  --border: 217 33% 17%;
  --muted: 217 33% 14%;
  --muted-foreground: 215 20% 65%;
  --primary: 199 89% 48%;
  --primary-foreground: 222 47% 6%;
  --up: 152 60% 45%;
  --down: 0 84% 60%;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 9: Write minimal `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Management",
  description: "Live markets dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Write minimal `app/page.tsx`**

```tsx
export default function Home() {
  return <main className="p-8">Markets dashboard coming up.</main>;
}
```

- [ ] **Step 11: Add npm scripts to `package.json`**

Open `package.json` and set the `"scripts"` field to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run"
}
```

- [ ] **Step 12: Verify the app boots**

Run: `npm run build`
Expected: build completes with no errors (a `.next` directory is created).

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts next-env.d.ts tailwind.config.ts postcss.config.js .gitignore app/
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind project"
```

---

### Task 2: Testing infrastructure

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `lib/smoke.test.ts`

- [ ] **Step 1: Install test deps**

```bash
npm install -D vitest@^1.6.0 @vitejs/plugin-react@^4.3.0 jsdom@^24.1.0 @testing-library/react@^14.3.0 @testing-library/jest-dom@^6.4.0
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write a failing smoke test — `lib/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("adds numbers", () => {
    expect(1 + 1).toBe(3);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run lib/smoke.test.ts`
Expected: FAIL — `expected 2 to be 3`

- [ ] **Step 6: Fix the assertion**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("adds numbers", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx vitest run lib/smoke.test.ts`
Expected: PASS

- [ ] **Step 8: Delete the smoke test**

The smoke test only existed to prove the harness works; remove `lib/smoke.test.ts` now — later tasks add real tests.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: add Vitest + React Testing Library"
```

---

### Task 3: UI primitives (cn helper, Button, Card, Badge, Skeleton, Tabs)

**Files:**
- Create: `lib/utils.ts`, `lib/utils.test.ts`
- Create: `components/ui/badge.tsx`, `components/ui/badge.test.tsx`
- Create: `components/ui/card.tsx`, `components/ui/card.test.tsx`
- Create: `components/ui/button.tsx`, `components/ui/button.test.tsx`
- Create: `components/ui/skeleton.tsx`, `components/ui/skeleton.test.tsx`
- Create: `components/ui/tabs.tsx`, `components/ui/tabs.test.tsx`

- [ ] **Step 1: Install deps**

```bash
npm install clsx@^2.1.0 tailwind-merge@^2.4.0 class-variance-authority@^0.7.0
```

- [ ] **Step 2: Write failing test — `lib/utils.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops falsy values", () => {
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/utils.test.ts`
Expected: FAIL — cannot find module `./utils`

- [ ] **Step 4: Implement `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/utils.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test — `components/ui/badge.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge variant="up">+2.1%</Badge>);
    expect(screen.getByText("+2.1%")).toBeInTheDocument();
  });

  it("applies the up variant color class", () => {
    render(<Badge variant="up">+2.1%</Badge>);
    expect(screen.getByText("+2.1%").className).toContain("text-up");
  });
});
```

- [ ] **Step 7: Run to verify it fails, then implement `components/ui/badge.tsx`**

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        up: "bg-up/15 text-up",
        down: "bg-down/15 text-down",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run components/ui/badge.test.tsx`
Expected: PASS

- [ ] **Step 9: Write failing test — `components/ui/card.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent } from "./card";

describe("Card", () => {
  it("renders title and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Fear & Greed</CardTitle>
        </CardHeader>
        <CardContent>68</CardContent>
      </Card>
    );
    expect(screen.getByText("Fear & Greed")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run to verify it fails, then implement `components/ui/card.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}
```

- [ ] **Step 11: Run to verify it passes**

Run: `npx vitest run components/ui/card.test.tsx`
Expected: PASS

- [ ] **Step 12: Write failing test — `components/ui/button.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders children and handles click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Sign out</Button>);
    fireEvent.click(screen.getByText("Sign out"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies the outline variant class", () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByText("Outline").className).toContain("border");
  });
});
```

- [ ] **Step 13: Run to verify it fails, then implement `components/ui/button.tsx`**

```tsx
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        ghost: "hover:bg-muted",
        outline: "border border-border hover:bg-muted",
      },
      size: {
        default: "h-9 px-4",
        icon: "h-9 w-9",
        sm: "h-8 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
```

- [ ] **Step 14: Run to verify it passes**

Run: `npx vitest run components/ui/button.test.tsx`
Expected: PASS

- [ ] **Step 15: Write failing test — `components/ui/skeleton.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder block", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
```

- [ ] **Step 16: Run to verify it fails, then implement `components/ui/skeleton.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
```

- [ ] **Step 17: Run to verify it passes**

Run: `npx vitest run components/ui/skeleton.test.tsx`
Expected: PASS

- [ ] **Step 18: Write failing test — `components/ui/tabs.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./tabs";

describe("Tabs", () => {
  it("marks the active option selected", () => {
    render(<Tabs value="15m" options={["1m", "5m", "15m"] as const} onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "15m" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "1m" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the clicked option", () => {
    const onChange = vi.fn();
    render(<Tabs value="15m" options={["1m", "5m", "15m"] as const} onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "1m" }));
    expect(onChange).toHaveBeenCalledWith("1m");
  });
});
```

- [ ] **Step 19: Run to verify it fails, then implement `components/ui/tabs.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

export interface TabsProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ value, options, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          role="tab"
          type="button"
          aria-selected={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            option === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 20: Run all UI primitive tests**

Run: `npx vitest run components/ui lib/utils.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 21: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts components/ui package.json package-lock.json
git commit -m "feat: add UI primitives (Button, Card, Badge, Skeleton, Tabs)"
```

---

### Task 4: Formatting utilities

**Files:**
- Create: `lib/format.ts`, `lib/format.test.ts`

- [ ] **Step 1: Write failing tests — `lib/format.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatPrice, formatPercent, formatCompact } from "./format";

describe("formatPrice", () => {
  it("formats prices >= 1 with 2 decimals and thousands separators", () => {
    expect(formatPrice(80243.35)).toBe("80,243.35");
  });

  it("formats prices between 0.01 and 1 with 4 decimals", () => {
    expect(formatPrice(0.09)).toBe("0.0900");
  });

  it("formats prices under 0.01 with 6 decimals", () => {
    expect(formatPrice(0.0000123)).toBe("0.000012");
  });
});

describe("formatPercent", () => {
  it("prefixes positive values with a plus sign", () => {
    expect(formatPercent(2.144)).toBe("+2.14%");
  });

  it("keeps the minus sign on negative values without a plus", () => {
    expect(formatPercent(-0.408)).toBe("-0.41%");
  });

  it("formats zero without a sign", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });
});

describe("formatCompact", () => {
  it("formats billions", () => {
    expect(formatCompact(4_820_000_000)).toBe("4.82B");
  });

  it("formats trillions", () => {
    expect(formatCompact(3_120_000_000_000)).toBe("3.12T");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL — cannot find module `./format`

- [ ] **Step 3: Implement `lib/format.ts`**

```ts
export function formatPrice(value: number): string {
  const fractionDigits = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number): string {
  const formatted = value.toFixed(2);
  return value > 0 ? `+${formatted}%` : `${formatted}%`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat: add price/percent/compact-number formatters"
```

---

### Task 5: Curated symbol list + selected-symbol store

**Files:**
- Create: `lib/symbols.ts`, `lib/symbols.test.ts`
- Create: `lib/store/symbol-store.ts`, `lib/store/symbol-store.test.ts`

- [ ] **Step 1: Install zustand**

```bash
npm install zustand@^4.5.0
```

- [ ] **Step 2: Write failing test — `lib/symbols.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { CURATED_SYMBOLS, DEFAULT_SYMBOL } from "./symbols";

describe("CURATED_SYMBOLS", () => {
  it("has 10 curated pairs, all quoted in USDT", () => {
    expect(CURATED_SYMBOLS).toHaveLength(10);
    expect(CURATED_SYMBOLS.every((s) => s.symbol.endsWith("USDT"))).toBe(true);
  });

  it("defaults to BTCUSDT", () => {
    expect(DEFAULT_SYMBOL).toBe("BTCUSDT");
  });

  it("labels PAXGUSDT as Gold with no matching futures contract", () => {
    const gold = CURATED_SYMBOLS.find((s) => s.symbol === "PAXGUSDT");
    expect(gold?.name).toBe("Gold");
    expect(gold?.futuresSymbol).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/symbols.test.ts`
Expected: FAIL — cannot find module `./symbols`

- [ ] **Step 4: Implement `lib/symbols.ts`**

```ts
export interface SymbolInfo {
  /** Binance spot symbol, e.g. "BTCUSDT" */
  symbol: string;
  /** Human-readable asset name, e.g. "Bitcoin" */
  name: string;
  /** Matching Binance USDT-margined perpetual symbol for funding rate, or null if none exists */
  futuresSymbol: string | null;
}

export const CURATED_SYMBOLS: readonly SymbolInfo[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", futuresSymbol: "BTCUSDT" },
  { symbol: "ETHUSDT", name: "Ethereum", futuresSymbol: "ETHUSDT" },
  { symbol: "SOLUSDT", name: "Solana", futuresSymbol: "SOLUSDT" },
  { symbol: "XRPUSDT", name: "XRP", futuresSymbol: "XRPUSDT" },
  { symbol: "ADAUSDT", name: "Cardano", futuresSymbol: "ADAUSDT" },
  { symbol: "DOGEUSDT", name: "Dogecoin", futuresSymbol: "DOGEUSDT" },
  { symbol: "AVAXUSDT", name: "Avalanche", futuresSymbol: "AVAXUSDT" },
  { symbol: "BNBUSDT", name: "BNB", futuresSymbol: "BNBUSDT" },
  { symbol: "DOTUSDT", name: "Polkadot", futuresSymbol: "DOTUSDT" },
  { symbol: "PAXGUSDT", name: "Gold", futuresSymbol: null },
];

export const DEFAULT_SYMBOL = CURATED_SYMBOLS[0].symbol;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/symbols.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test — `lib/store/symbol-store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSymbolStore } from "./symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

describe("useSymbolStore", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
  });

  it("defaults to the default symbol", () => {
    const { result } = renderHook(() => useSymbolStore());
    expect(result.current.selectedSymbol).toBe(DEFAULT_SYMBOL);
  });

  it("updates the selected symbol", () => {
    const { result } = renderHook(() => useSymbolStore());
    act(() => result.current.selectSymbol("ETHUSDT"));
    expect(result.current.selectedSymbol).toBe("ETHUSDT");
  });
});
```

- [ ] **Step 7: Run to verify it fails, then implement `lib/store/symbol-store.ts`**

```ts
import { create } from "zustand";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

interface SymbolStore {
  selectedSymbol: string;
  selectSymbol: (symbol: string) => void;
}

export const useSymbolStore = create<SymbolStore>((set) => ({
  selectedSymbol: DEFAULT_SYMBOL,
  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),
}));
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run lib/store/symbol-store.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/symbols.ts lib/symbols.test.ts lib/store package.json package-lock.json
git commit -m "feat: add curated symbol list and selected-symbol store"
```

---

### Task 6: Binance REST client — ticker and klines

**Files:**
- Create: `lib/binance/rest.ts`, `lib/binance/rest.test.ts`

- [ ] **Step 1: Write failing tests — `lib/binance/rest.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTicker24hr, fetchKlines } from "./rest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTicker24hr", () => {
  it("requests the given symbols and normalizes numeric fields", async () => {
    const payload = [
      {
        symbol: "BTCUSDT",
        lastPrice: "80243.35000000",
        priceChangePercent: "2.140",
        highPrice: "81687.73000000",
        lowPrice: "78798.97000000",
        volume: "59234.12000000",
        quoteVolume: "4820000000.00000000",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTicker24hr(["BTCUSDT"]);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("BTCUSDT"));
    expect(result).toEqual([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 81687.73,
        lowPrice: 78798.97,
        volume: 59234.12,
        quoteVolume: 4_820_000_000,
      },
    ]);
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchTicker24hr(["BTCUSDT"])).rejects.toThrow("429");
  });
});

describe("fetchKlines", () => {
  it("requests the symbol/interval and maps array rows to objects", async () => {
    const payload = [
      [1735689600000, "80000.00", "80500.00", "79800.00", "80243.35", "120.5", 1735690499999],
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKlines("BTCUSDT", "15m", 200);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("symbol=BTCUSDT&interval=15m&limit=200")
    );
    expect(result).toEqual([
      {
        openTime: 1735689600000,
        open: 80000,
        high: 80500,
        low: 79800,
        close: 80243.35,
        volume: 120.5,
        closeTime: 1735690499999,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: FAIL — cannot find module `./rest`

- [ ] **Step 3: Implement `lib/binance/rest.ts`**

```ts
const SPOT_BASE_URL = "https://api.binance.com";

export interface Ticker24hr {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

interface RawTicker24hr {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function fetchTicker24hr(symbols: string[]): Promise<Ticker24hr[]> {
  const url = `${SPOT_BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker24hr failed: ${res.status}`);
  const data: RawTicker24hr[] = await res.json();
  return data.map((d) => ({
    symbol: d.symbol,
    lastPrice: Number(d.lastPrice),
    priceChangePercent: Number(d.priceChangePercent),
    highPrice: Number(d.highPrice),
    lowPrice: Number(d.lowPrice),
    volume: Number(d.volume),
    quoteVolume: Number(d.quoteVolume),
  }));
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

type RawKline = [number, string, string, string, string, string, number, ...unknown[]];

// Binance's interval strings are case-sensitive in a way that matters:
// "1m" is one minute, "1M" is one month — they're both valid, distinct
// values, so this must stay a literal union, never normalized with
// .toLowerCase()/.toUpperCase() at any call site.
export type BinanceInterval =
  | "1s"
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h" | "6h" | "8h" | "12h"
  | "1d" | "3d" | "1w" | "1M";

export async function fetchKlines(
  symbol: string,
  interval: BinanceInterval,
  limit = 200
): Promise<Kline[]> {
  const url = `${SPOT_BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const data: RawKline[] = await res.json();
  return data.map((row) => ({
    openTime: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6],
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/binance/rest.ts lib/binance/rest.test.ts
git commit -m "feat: add Binance REST client for ticker and klines"
```

---

### Task 7: Binance Futures REST — funding rate, long/short ratio, open interest

**Files:**
- Modify: `lib/binance/rest.ts` (append after `fetchKlines`)
- Modify: `lib/binance/rest.test.ts` (append after the `fetchKlines` describe block)

- [ ] **Step 1: Append failing tests to `lib/binance/rest.test.ts`**

```ts
import { fetchFundingRate, fetchLongShortRatio, fetchOpenInterest } from "./rest";

describe("fetchFundingRate", () => {
  it("returns the last funding rate and mark/index prices for a perpetual symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          symbol: "BTCUSDT",
          lastFundingRate: "0.00010000",
          markPrice: "80260.10000000",
          indexPrice: "80243.35000000",
        }),
      })
    );
    const result = await fetchFundingRate("BTCUSDT");
    expect(result).toEqual({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260.1,
      indexPrice: 80243.35,
    });
  });
});

describe("fetchLongShortRatio", () => {
  it("returns the latest long/short account ratio entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ longAccount: "0.64", shortAccount: "0.36" }],
      })
    );
    const result = await fetchLongShortRatio("BTCUSDT");
    expect(result).toEqual({ longAccount: 0.64, shortAccount: 0.36 });
  });
});

describe("fetchOpenInterest", () => {
  it("returns open interest for a symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ symbol: "BTCUSDT", openInterest: "48600.123" }),
      })
    );
    const result = await fetchOpenInterest("BTCUSDT");
    expect(result).toEqual({ symbol: "BTCUSDT", openInterest: 48600.123 });
  });
});
```

Add the new `import { fetchFundingRate, fetchLongShortRatio, fetchOpenInterest } from "./rest";` line into the existing top-of-file import from `./rest` (merge with the existing `fetchTicker24hr, fetchKlines` import) rather than as a second import statement.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: FAIL — `fetchFundingRate` is not exported

- [ ] **Step 3: Append implementation to `lib/binance/rest.ts`**

```ts
const FUTURES_BASE_URL = "https://fapi.binance.com";

export interface FundingRate {
  symbol: string;
  lastFundingRate: number;
  markPrice: number;
  indexPrice: number;
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance premiumIndex failed: ${res.status}`);
  const data = await res.json();
  return {
    symbol: data.symbol,
    lastFundingRate: Number(data.lastFundingRate),
    markPrice: Number(data.markPrice),
    indexPrice: Number(data.indexPrice),
  };
}

export interface LongShortRatio {
  longAccount: number;
  shortAccount: number;
}

export async function fetchLongShortRatio(symbol: string): Promise<LongShortRatio> {
  const url = `${FUTURES_BASE_URL}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=15m&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance longShortRatio failed: ${res.status}`);
  const data = await res.json();
  const latest = data[0];
  return { longAccount: Number(latest.longAccount), shortAccount: Number(latest.shortAccount) };
}

export interface OpenInterest {
  symbol: string;
  openInterest: number;
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterest> {
  const url = `${FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance openInterest failed: ${res.status}`);
  const data = await res.json();
  return { symbol: data.symbol, openInterest: Number(data.openInterest) };
}
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/binance/rest.ts lib/binance/rest.test.ts
git commit -m "feat: add funding rate, long/short ratio, open interest fetchers"
```

---

### Task 8: Fear & Greed fetcher + CoinGecko global-stats proxy route

**Files:**
- Create: `lib/external/fear-greed.ts`, `lib/external/fear-greed.test.ts`
- Create: `app/api/global-stats/route.ts`, `app/api/global-stats/route.test.ts`
- Create: `lib/external/coingecko.ts`, `lib/external/coingecko.test.ts`

- [ ] **Step 1: Write failing test — `lib/external/fear-greed.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchFearGreed } from "./fear-greed";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFearGreed", () => {
  it("returns the latest index value and classification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ value: "68", value_classification: "Greed", timestamp: "1735689600" }],
        }),
      })
    );

    const result = await fetchFearGreed();

    expect(result).toEqual({ value: 68, classification: "Greed" });
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchFearGreed()).rejects.toThrow("503");
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `lib/external/fear-greed.ts`**

```ts
export interface FearGreed {
  value: number;
  classification: string;
}

export async function fetchFearGreed(): Promise<FearGreed> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error(`Fear & Greed request failed: ${res.status}`);
  const data = await res.json();
  const latest = data.data[0];
  return { value: Number(latest.value), classification: latest.value_classification };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run lib/external/fear-greed.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 4: Write failing test — `app/api/global-stats/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("GET /api/global-stats", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and maps CoinGecko global stats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total_market_cap: { usd: 3_120_000_000_000 },
          total_volume: { usd: 142_800_000_000 },
          market_cap_percentage: { btc: 54.2 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({
      totalMarketCapUsd: 3_120_000_000_000,
      totalVolumeUsd: 142_800_000_000,
      btcDominance: 54.2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves cached data on a second call without re-fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          total_market_cap: { usd: 1 },
          total_volume: { usd: 1 },
          market_cap_percentage: { btc: 1 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET();
    await GET();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Run to verify it fails, then implement `app/api/global-stats/route.ts`**

```ts
import { NextResponse } from "next/server";

export interface GlobalStats {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  btcDominance: number;
}

let cache: { data: GlobalStats; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  const res = await fetch("https://api.coingecko.com/api/v3/global");
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch global stats" }, { status: 502 });
  }
  const body = await res.json();
  const data: GlobalStats = {
    totalMarketCapUsd: body.data.total_market_cap.usd,
    totalVolumeUsd: body.data.total_volume.usd,
    btcDominance: body.data.market_cap_percentage.btc,
  };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(data);
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run app/api/global-stats/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Write failing test — `lib/external/coingecko.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGlobalStats } from "./coingecko";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGlobalStats", () => {
  it("calls the internal global-stats route and returns its JSON", async () => {
    const payload = { totalMarketCapUsd: 3_120_000_000_000, totalVolumeUsd: 142_800_000_000, btcDominance: 54.2 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGlobalStats();

    expect(fetchMock).toHaveBeenCalledWith("/api/global-stats");
    expect(result).toEqual(payload);
  });
});
```

- [ ] **Step 8: Run to verify it fails, then implement `lib/external/coingecko.ts`**

```ts
import type { GlobalStats } from "@/app/api/global-stats/route";

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const res = await fetch("/api/global-stats");
  if (!res.ok) throw new Error(`Global stats request failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run lib/external/coingecko.test.ts`
Expected: PASS (1 test)

- [ ] **Step 10: Commit**

```bash
git add lib/external app/api/global-stats
git commit -m "feat: add Fear & Greed fetcher and CoinGecko global-stats proxy"
```

---

### Task 9: Binance WebSocket manager (reconnect/backoff) + live-data hooks

WebSocket timing isn't meaningfully unit-testable (per the design spec's Testing section), so this task TDDs the two pieces of *pure logic* — the backoff schedule and the reconnect-on-close behavior — using a fake, dependency-injected WebSocket class. The four React hooks built on top are thin wrappers verified later by running the app in a real browser (Task 21).

**Files:**
- Create: `lib/binance/ws.ts`, `lib/binance/ws.test.ts`

- [ ] **Step 1: Write failing test — backoff schedule in `lib/binance/ws.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { nextBackoffDelayMs, createReconnectingStream } from "./ws";

describe("nextBackoffDelayMs", () => {
  it("doubles from a 500ms base and caps at 15000ms", () => {
    expect(nextBackoffDelayMs(0)).toBe(500);
    expect(nextBackoffDelayMs(1)).toBe(1000);
    expect(nextBackoffDelayMs(2)).toBe(2000);
    expect(nextBackoffDelayMs(5)).toBe(15000);
    expect(nextBackoffDelayMs(10)).toBe(15000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binance/ws.test.ts`
Expected: FAIL — cannot find module `./ws`

- [ ] **Step 3: Implement `nextBackoffDelayMs` in `lib/binance/ws.ts`**

```ts
export function nextBackoffDelayMs(attempt: number): number {
  const base = 500;
  const max = 15_000;
  return Math.min(base * 2 ** attempt, max);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/binance/ws.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write failing test — reconnect behavior**

Append to `lib/binance/ws.test.ts`:

```ts
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("createReconnectingStream", () => {
  it("opens a socket to the given URL and forwards parsed messages", () => {
    FakeWebSocket.instances = [];
    const onMessage = vi.fn();
    createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage,
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe("wss://example.test/stream");
    socket.onmessage?.({ data: JSON.stringify({ hello: "world" }) });
    expect(onMessage).toHaveBeenCalledWith({ hello: "world" });
  });

  it("reconnects with an incrementing attempt count when the socket closes unexpectedly", () => {
    FakeWebSocket.instances = [];
    const scheduleReconnect = vi.fn((_attempt: number, reconnect: () => void) => reconnect());

    createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage: () => {},
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      scheduleReconnect,
    });

    FakeWebSocket.instances[0].onclose?.();
    FakeWebSocket.instances[1].onclose?.();

    expect(scheduleReconnect).toHaveBeenNthCalledWith(1, 1, expect.any(Function));
    expect(scheduleReconnect).toHaveBeenNthCalledWith(2, 2, expect.any(Function));
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("does not reconnect after close() is called by the caller", () => {
    FakeWebSocket.instances = [];
    const scheduleReconnect = vi.fn();

    const stream = createReconnectingStream({
      url: "wss://example.test/stream",
      onMessage: () => {},
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      scheduleReconnect,
    });

    stream.close();
    FakeWebSocket.instances[0].onclose?.();

    expect(scheduleReconnect).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances[0].closed).toBe(true);
  });
});
```

- [ ] **Step 6: Run to verify the new tests fail**

Run: `npx vitest run lib/binance/ws.test.ts`
Expected: FAIL — `createReconnectingStream` is not exported

- [ ] **Step 7: Implement `createReconnectingStream` in `lib/binance/ws.ts`**

Append below `nextBackoffDelayMs`:

```ts
export interface ReconnectingStreamOptions {
  url: string;
  onMessage: (data: unknown) => void;
  WebSocketImpl?: typeof WebSocket;
  scheduleReconnect?: (attempt: number, reconnect: () => void) => void;
}

export function createReconnectingStream(options: ReconnectingStreamOptions) {
  const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let closedByCaller = false;

  function connect() {
    if (closedByCaller) return;
    socket = new WebSocketImpl(options.url);
    socket.onmessage = (event: MessageEvent) => {
      attempt = 0;
      try {
        options.onMessage(JSON.parse(event.data as string));
      } catch {
        // Ignore malformed frames rather than crashing the socket handler.
      }
    };
    socket.onclose = () => {
      if (closedByCaller) return;
      attempt += 1;
      if (options.scheduleReconnect) {
        options.scheduleReconnect(attempt, connect);
      } else {
        setTimeout(connect, nextBackoffDelayMs(attempt - 1));
      }
    };
  }

  connect();

  return {
    close() {
      closedByCaller = true;
      if (socket) {
        socket.onmessage = null;
        socket.onclose = null;
      }
      socket?.close();
    },
  };
}
```

(Note: the original version reset `attempt` in `onopen` and had no guard in `connect()` against a stream already closed by the caller. That combination caused two real bugs, caught in code review: (1) a pending reconnect `setTimeout` fired after `close()`, leaking a zombie WebSocket connection nothing was listening for; (2) if a socket opened and then immediately closed — exactly what happens with an invalid stream name, see the `useBinanceDepth` fix below — `attempt` reset to 0 before `onclose` incremented it, defeating backoff entirely against a "connects then instantly rejects" endpoint. Fixed by guarding `connect()` and moving the reset to `onmessage`, which only fires once the connection has proven it can actually deliver data.)

- [ ] **Step 8: Run to verify all tests pass**

Run: `npx vitest run lib/binance/ws.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Implement the live-data hooks**

Append to `lib/binance/ws.ts` (not unit tested — see the task header for why):

```ts
"use client";

import { useEffect, useState } from "react";
import type { BinanceInterval } from "@/lib/binance/rest";

function useBinanceStream<T>(streamPath: string, parse: (msg: any) => T): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    setData(null);
    const stream = createReconnectingStream({
      url: `wss://stream.binance.com:9443/ws/${streamPath}`,
      onMessage: (msg) => setData(parse(msg)),
    });
    return () => stream.close();
  }, [streamPath]);

  return data;
}

export interface LiveTicker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
}

export function useBinanceTicker(symbol: string): LiveTicker | null {
  return useBinanceStream<LiveTicker>(`${symbol.toLowerCase()}@ticker`, (msg) => ({
    symbol: msg.s,
    lastPrice: Number(msg.c),
    priceChangePercent: Number(msg.P),
  }));
}

export interface LiveKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;
}

export function useBinanceKline(symbol: string, interval: BinanceInterval): LiveKline | null {
  return useBinanceStream<LiveKline>(`${symbol.toLowerCase()}@kline_${interval}`, (msg) => ({
    openTime: msg.k.t,
    open: Number(msg.k.o),
    high: Number(msg.k.h),
    low: Number(msg.k.l),
    close: Number(msg.k.c),
    volume: Number(msg.k.v),
    isFinal: msg.k.x,
  }));
}

export interface DepthLevel {
  price: number;
  quantity: number;
}

export interface LiveDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export function useBinanceDepth(symbol: string, levels = 20): LiveDepth | null {
  return useBinanceStream<LiveDepth>(`${symbol.toLowerCase()}@depth${levels}@1000ms`, (msg) => ({
    bids: msg.bids.map(([price, quantity]: [string, string]) => ({
      price: Number(price),
      quantity: Number(quantity),
    })),
    asks: msg.asks.map(([price, quantity]: [string, string]) => ({
      price: Number(price),
      quantity: Number(quantity),
    })),
  }));
}
```

(Note: originally defaulted to `levels = 15`, but Binance's Partial Book Depth Stream only supports levels 5, 10, or 20 — `@depth15@1000ms` isn't a valid stream name, so the order book panel would never have received data. Fixed to `20`, an actual supported value.)

```ts
export interface LiveTrade {
  id: number;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

export function useBinanceTrades(symbol: string, maxTrades = 20): LiveTrade[] {
  const [trades, setTrades] = useState<LiveTrade[]>([]);

  useEffect(() => {
    setTrades([]);
    const stream = createReconnectingStream({
      url: `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`,
      onMessage: (msg: any) => {
        setTrades((prev) =>
          [
            {
              id: msg.t,
              price: Number(msg.p),
              quantity: Number(msg.q),
              time: msg.T,
              isBuyerMaker: msg.m,
            },
            ...prev,
          ].slice(0, maxTrades)
        );
      },
    });
    return () => stream.close();
  }, [symbol, maxTrades]);

  return trades;
}
```

(Note: originally keyed nothing beyond `time`, a millisecond timestamp. Code review on Task 17 — the panel consuming this hook — found Binance's real trade-stream message carries a unique trade ID in field `t` that was being discarded, and that same-millisecond duplicate trades are a routine occurrence during order-sweep fills on a liquid symbol, not a rare edge case. Added `id` so Task 17's panel can key rows uniquely instead of by timestamp.)

- [ ] **Step 10: Run the full test file once more to confirm nothing broke**

Run: `npx vitest run lib/binance/ws.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 11: Commit**

```bash
git add lib/binance/ws.ts lib/binance/ws.test.ts
git commit -m "feat: add reconnecting WebSocket manager and live Binance data hooks"
```

---

### Task 10: TanStack Query provider + stale-aware query hook

**Files:**
- Create: `lib/query/query-provider.tsx`
- Create: `lib/query/use-stale-query.ts`, `lib/query/use-stale-query.test.tsx`

- [ ] **Step 1: Install TanStack Query**

```bash
npm install @tanstack/react-query@^5.51.0
```

- [ ] **Step 2: Write `lib/query/query-provider.tsx`** (no dedicated test — thin provider wiring, exercised by every component test that renders through it)

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Write failing test — `lib/query/use-stale-query.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStaleAwareQuery } from "./use-stale-query";

describe("useStaleAwareQuery", () => {
  it("returns fresh data once the query succeeds", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["test"], queryFn: async () => "fresh" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("fresh"));
    expect(result.current.isStale).toBe(false);
  });

  it("keeps the last good data and flags isStale when a refetch errors", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) return "fresh";
      throw new Error("network down");
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["test"], queryFn, staleTime: 0 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("fresh"));

    await client.refetchQueries({ queryKey: ["test"] });
    rerender();

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.data).toBe("fresh");
  });

  it("does not carry stale data across a query key change", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    let symbol = "BTC";
    const queryFn = vi.fn(async () => (symbol === "BTC" ? "btc-data" : "eth-data"));

    const { result, rerender } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["symbol", symbol], queryFn }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("btc-data"));

    symbol = "ETH";
    rerender();

    expect(result.current.data).toBeUndefined();
    expect(result.current.isStale).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.data).toBe("eth-data"));
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run lib/query/use-stale-query.test.tsx`
Expected: FAIL — cannot find module `./use-stale-query`

- [ ] **Step 5: Implement `lib/query/use-stale-query.ts`**

```ts
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useRef } from "react";

export interface StaleAwareResult<T> {
  data: T | undefined;
  isStale: boolean;
  isLoading: boolean;
}

export function useStaleAwareQuery<T>(options: UseQueryOptions<T>): StaleAwareResult<T> {
  const query = useQuery(options);
  const serializedKey = JSON.stringify(options.queryKey);
  const lastGoodData = useRef<{ key: string; data: T } | undefined>(undefined);

  if (query.data !== undefined) {
    lastGoodData.current = { key: serializedKey, data: query.data };
  }

  const hasMatchingCachedData = lastGoodData.current?.key === serializedKey;
  const data =
    query.data !== undefined
      ? query.data
      : hasMatchingCachedData
        ? lastGoodData.current!.data
        : undefined;
  const isStale = query.isError && hasMatchingCachedData;

  return { data, isStale, isLoading: query.isLoading && !hasMatchingCachedData };
}
```

(Note: the original version kept `lastGoodData` in a bare `useRef<T>`, with no record of which query key it belonged to. TanStack Query itself already preserves `data` across a failed same-key refetch — verified empirically during implementation — so the ref only actually diverges from `query.data` in one case: a query-key change, e.g. switching the selected trading symbol. In that case the un-keyed ref would keep serving the *previous* symbol's data, misreported as valid/fresh, instead of a loading state — a real bug given ~10 later panels key queries by the selected symbol. Fixed by tagging the cached value with the key it came from and only serving it as a fallback when the key still matches.)

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run lib/query/use-stale-query.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/query package.json package-lock.json
git commit -m "feat: add TanStack Query provider and stale-aware query hook"
```

---

### Task 11: Root layout, theme toggle, nav, footer, and placeholder pages

**Files:**
- Create: `components/layout/theme-toggle.tsx`, `components/layout/theme-toggle.test.tsx`
- Create: `components/layout/coming-soon.tsx`, `components/layout/coming-soon.test.tsx`
- Create: `components/layout/top-nav.tsx`, `components/layout/top-nav.test.tsx`
- Create: `components/layout/footer.tsx`, `components/layout/footer.test.tsx`
- Modify: `app/layout.tsx` (replace the minimal Task 1 version)
- Create: `app/trade-desk/page.tsx`, `app/portfolio/page.tsx`, `app/strategies/page.tsx`, `app/analyzer/page.tsx`, `app/news/page.tsx`, `app/company/page.tsx`

- [ ] **Step 1: Install next-themes**

```bash
npm install next-themes@^0.3.0
```

- [ ] **Step 2: Write failing test — `components/layout/theme-toggle.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("toggles the document theme class when clicked", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
  });
});
```

- [ ] **Step 3: Run to verify it fails, then implement `components/layout/theme-toggle.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" />;
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? "🌞" : "🌙"}
    </Button>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/layout/theme-toggle.test.tsx`
Expected: PASS

- [ ] **Step 5: Write failing test — `components/layout/coming-soon.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoon } from "./coming-soon";

describe("ComingSoon", () => {
  it("shows the feature title and a coming-later message", () => {
    render(<ComingSoon title="Trade Desk" />);
    expect(screen.getByRole("heading", { name: "Trade Desk" })).toBeInTheDocument();
    expect(screen.getByText(/coming in a later phase/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run to verify it fails, then implement `components/layout/coming-soon.tsx`**

```tsx
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">This part of the platform is coming in a later phase.</p>
    </main>
  );
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx vitest run components/layout/coming-soon.test.tsx`
Expected: PASS

- [ ] **Step 8: Write failing test — `components/layout/top-nav.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { TopNav } from "./top-nav";

function renderNav() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TopNav />
    </ThemeProvider>
  );
}

describe("TopNav", () => {
  it("links to every section, including not-yet-built phases", () => {
    renderNav();
    const expected: Record<string, string> = {
      Markets: "/",
      "Trade Desk": "/trade-desk",
      Portfolio: "/portfolio",
      Strategies: "/strategies",
      Analyzer: "/analyzer",
      News: "/news",
      Company: "/company",
    };
    for (const [label, href] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("has no sign-in or sign-up affordance", () => {
    renderNav();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
  });

  it("renders a markets search input", () => {
    renderNav();
    expect(screen.getByPlaceholderText(/search markets/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Run to verify it fails, then implement `components/layout/top-nav.tsx`**

```tsx
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/trade-desk", label: "Trade Desk" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/strategies", label: "Strategies" },
  { href: "/analyzer", label: "Analyzer" },
  { href: "/news", label: "News" },
  { href: "/company", label: "Company" },
] as const;

export function TopNav() {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-8">
        <span className="text-lg font-bold">Trading Management</span>
        <nav className="flex items-center gap-5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search markets..."
          className="w-56 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm outline-none"
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `npx vitest run components/layout/top-nav.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 11: Write failing test — `components/layout/footer.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";

describe("Footer", () => {
  it("renders every column heading and a sample link from each", () => {
    render(<Footer />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trade Desk" })).toHaveAttribute("href", "/trade-desk");
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Strategies" })).toHaveAttribute("href", "/strategies");
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/company");
  });
});
```

- [ ] **Step 12: Run to verify it fails, then implement `components/layout/footer.tsx`**

```tsx
import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Trade Desk", href: "/trade-desk" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Live Markets", href: "/" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Strategies", href: "/strategies" },
      { label: "Analyzer", href: "/analyzer" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "News", href: "/news" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="mb-3 text-sm font-semibold">{column.title}</h4>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
```

- [ ] **Step 13: Run to verify it passes**

Run: `npx vitest run components/layout/footer.test.tsx`
Expected: PASS

- [ ] **Step 14: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/lib/query/query-provider";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Management",
  description: "Live markets dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            <TopNav />
            {children}
            <Footer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 15: Create the six placeholder pages**

`app/trade-desk/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function TradeDeskPage() {
  return <ComingSoon title="Trade Desk" />;
}
```

`app/portfolio/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function PortfolioPage() {
  return <ComingSoon title="Portfolio" />;
}
```

`app/strategies/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function StrategiesPage() {
  return <ComingSoon title="Strategies" />;
}
```

`app/analyzer/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function AnalyzerPage() {
  return <ComingSoon title="Analyzer" />;
}
```

`app/news/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function NewsPage() {
  return <ComingSoon title="News" />;
}
```

`app/company/page.tsx`:

```tsx
import { ComingSoon } from "@/components/layout/coming-soon";

export default function CompanyPage() {
  return <ComingSoon title="Company" />;
}
```

- [ ] **Step 16: Verify the whole app still builds**

Run: `npm run build`
Expected: build completes with no errors

- [ ] **Step 17: Commit**

```bash
git add components/layout app/layout.tsx app/trade-desk app/portfolio app/strategies app/analyzer app/news app/company package.json package-lock.json
git commit -m "feat: add app shell (nav, theme toggle, footer) and placeholder pages"
```

---

### Task 12: Shared query-test helper + stale badge

**Files:**
- Create: `lib/test-utils.tsx` (test infrastructure — no dedicated test, exercised by every panel test from here on)
- Create: `components/markets/stale-badge.tsx`, `components/markets/stale-badge.test.tsx`

- [ ] **Step 1: Write `lib/test-utils.tsx`**

```tsx
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
```

- [ ] **Step 2: Write failing test — `components/markets/stale-badge.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaleBadge } from "./stale-badge";

describe("StaleBadge", () => {
  it("renders a Stale label", () => {
    render(<StaleBadge />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails, then implement `components/markets/stale-badge.tsx`**

```tsx
export function StaleBadge() {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Stale
    </span>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/markets/stale-badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/test-utils.tsx components/markets/stale-badge.tsx components/markets/stale-badge.test.tsx
git commit -m "test: add shared query-client test helper and stale badge"
```

---

### Task 13: Ticker strip

**Files:**
- Create: `components/markets/ticker-strip.tsx`, `components/markets/ticker-strip.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/ticker-strip.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { TickerStrip } from "./ticker-strip";
import * as rest from "@/lib/binance/rest";

describe("TickerStrip", () => {
  it("renders each returned symbol's price and change badge", async () => {
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);

    renderWithQueryClient(<TickerStrip />);

    await waitFor(() => expect(screen.getByText("BTCUSDT")).toBeInTheDocument());
    expect(screen.getByText("80,243.35")).toBeInTheDocument();
    expect(screen.getByText("+2.14%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/markets/ticker-strip.test.tsx`
Expected: FAIL — cannot find module `./ticker-strip`

- [ ] **Step 3: Implement `components/markets/ticker-strip.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPrice, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "./stale-badge";

export function TickerStrip() {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "strip"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-x-auto border-b border-border px-6 py-2">
        {CURATED_SYMBOLS.map((s) => (
          <Skeleton key={s.symbol} className="h-5 w-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 overflow-x-auto border-b border-border px-6 py-2">
      {isStale && <StaleBadge />}
      {data?.map((ticker) => (
        <div key={ticker.symbol} className="flex shrink-0 items-center gap-2 text-sm">
          <span className="font-medium">{ticker.symbol}</span>
          <span>{formatPrice(ticker.lastPrice)}</span>
          <Badge variant={ticker.priceChangePercent >= 0 ? "up" : "down"}>
            {formatPercent(ticker.priceChangePercent)}
          </Badge>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/markets/ticker-strip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/markets/ticker-strip.tsx components/markets/ticker-strip.test.tsx
git commit -m "feat: add live ticker strip"
```

---

### Task 14: Markets list + market card (symbol selection)

**Files:**
- Create: `components/markets/market-card.tsx`, `components/markets/market-card.test.tsx`
- Create: `components/markets/markets-list.tsx`, `components/markets/markets-list.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/market-card.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketCard } from "./market-card";

const info = { symbol: "BTCUSDT", name: "Bitcoin", futuresSymbol: "BTCUSDT" };
const ticker = {
  symbol: "BTCUSDT",
  lastPrice: 80243.35,
  priceChangePercent: 2.14,
  highPrice: 81687.73,
  lowPrice: 78798.97,
  volume: 59234.12,
  quoteVolume: 4_820_000_000,
};

describe("MarketCard", () => {
  it("shows the asset name, price, and an up badge for positive change", () => {
    render(<MarketCard info={info} ticker={ticker} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    expect(screen.getByText("80,243.35")).toBeInTheDocument();
    expect(screen.getByText("+2.14%")).toHaveClass("text-up");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<MarketCard info={info} ticker={ticker} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("marks itself pressed when selected", () => {
    render(<MarketCard info={info} ticker={ticker} selected onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/market-card.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { formatPrice, formatPercent, formatCompact } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { Ticker24hr } from "@/lib/binance/rest";
import type { SymbolInfo } from "@/lib/symbols";

export interface MarketCardProps {
  info: SymbolInfo;
  ticker?: Ticker24hr;
  selected: boolean;
  onSelect: () => void;
}

export function MarketCard({ info, ticker, selected, onSelect }: MarketCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-primary bg-muted" : "border-border hover:bg-muted"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{info.symbol}</span>
        {ticker && (
          <Badge variant={ticker.priceChangePercent >= 0 ? "up" : "down"}>
            {formatPercent(ticker.priceChangePercent)}
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{info.name}</span>
      <span className="text-lg font-bold">{ticker ? formatPrice(ticker.lastPrice) : "—"}</span>
      <span className="text-xs text-muted-foreground">
        Vol {ticker ? formatCompact(ticker.quoteVolume) : "—"}
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/market-card.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 4: Write failing test — `components/markets/markets-list.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { MarketsList } from "./markets-list";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import * as rest from "@/lib/binance/rest";

describe("MarketsList", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "ETHUSDT",
        lastPrice: 2507.76,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
  });

  it("marks the default symbol's card as selected", async () => {
    renderWithQueryClient(<MarketsList />);
    await waitFor(() => expect(screen.getByText("80,243.35")).toBeInTheDocument());
    const cards = screen.getAllByRole("button");
    const btcCard = cards.find((c) => c.textContent?.includes("BTCUSDT"));
    expect(btcCard).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the selected symbol in the store when a different card is clicked", async () => {
    renderWithQueryClient(<MarketsList />);
    await waitFor(() => expect(screen.getByText("2,507.76")).toBeInTheDocument());
    const cards = screen.getAllByRole("button");
    const ethCard = cards.find((c) => c.textContent?.includes("ETHUSDT"))!;
    fireEvent.click(ethCard);
    expect(useSymbolStore.getState().selectedSymbol).toBe("ETHUSDT");
  });
});
```

- [ ] **Step 5: Run to verify it fails, then implement `components/markets/markets-list.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "./stale-badge";
import { MarketCard } from "./market-card";

export function MarketsList() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const selectSymbol = useSymbolStore((s) => s.selectSymbol);

  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "list"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {CURATED_SYMBOLS.map((s) => (
          <Skeleton key={s.symbol} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isStale && <StaleBadge />}
      {CURATED_SYMBOLS.map((info) => (
        <MarketCard
          key={info.symbol}
          info={info}
          ticker={data?.find((t) => t.symbol === info.symbol)}
          selected={info.symbol === selectedSymbol}
          onSelect={() => selectSymbol(info.symbol)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run components/markets/markets-list.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add components/markets/market-card.tsx components/markets/market-card.test.tsx components/markets/markets-list.tsx components/markets/markets-list.test.tsx
git commit -m "feat: add markets list with symbol selection"
```

---

### Task 15: Candlestick chart + chart panel header

`lightweight-charts` renders to canvas, which isn't meaningfully testable in jsdom — so the test mocks the library and asserts the *wiring* (the right data reaches `setData`), not the rendered pixels. Live updates (`useBinanceKline`) are mocked out here too and verified manually in Task 21.

**Files:**
- Create: `components/markets/candlestick-chart.tsx`, `components/markets/candlestick-chart.test.tsx`
- Create: `components/markets/chart-panel.tsx`, `components/markets/chart-panel.test.tsx`

- [ ] **Step 1: Install lightweight-charts**

```bash
npm install lightweight-charts@^4.2.0
```

- [ ] **Step 2: Write failing test — `components/markets/candlestick-chart.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const addCandlestickSeries = vi.fn();
const chartRemove = vi.fn();
const createChart = vi.fn();

vi.mock("lightweight-charts", () => ({
  createChart: (...args: unknown[]) => createChart(...args),
}));

vi.mock("@/lib/binance/ws", () => ({
  useBinanceKline: () => null,
}));

vi.mock("@/lib/binance/rest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/binance/rest")>();
  return { ...actual, fetchKlines: vi.fn() };
});

import { CandlestickChart } from "./candlestick-chart";
import { fetchKlines } from "@/lib/binance/rest";

describe("CandlestickChart", () => {
  const setData = vi.fn();

  beforeEach(() => {
    setData.mockClear();
    addCandlestickSeries.mockReturnValue({ setData, update: vi.fn() });
    createChart.mockReturnValue({ addCandlestickSeries, remove: chartRemove });
    vi.mocked(fetchKlines).mockResolvedValue([
      {
        openTime: 1735689600000,
        open: 80000,
        high: 80500,
        low: 79800,
        close: 80243.35,
        volume: 120.5,
        closeTime: 1735690499999,
      },
    ]);
  });

  it("fetches klines for the given symbol/interval and plots them", async () => {
    render(<CandlestickChart symbol="BTCUSDT" interval="15m" />);

    expect(fetchKlines).toHaveBeenCalledWith("BTCUSDT", "15m", 200);

    await waitFor(() =>
      expect(setData).toHaveBeenCalledWith([
        { time: 1735689600, open: 80000, high: 80500, low: 79800, close: 80243.35 },
      ])
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run components/markets/candlestick-chart.test.tsx`
Expected: FAIL — cannot find module `./candlestick-chart`

- [ ] **Step 4: Implement `components/markets/candlestick-chart.tsx`**

(Note: this block is the original version. Two later fixes supersede it and are not re-transcribed here in full — see git history: commit `99f16f2` "fix: guard against stale chart-series closure, handle fetch errors, tighten cast" replaced `toChartPoint`'s parameter type with a structural `ChartPointSource` interface and added a `cancelled` guard + `.catch()` around the klines fetch; commit `a48403b`'s follow-up types `CandlestickChartProps.interval` and `toChartPoint`'s `openTime` source as `BinanceInterval`/using the shared interval type below instead of a bare `string`, so a caller can no longer pass an interval string Binance doesn't actually accept. Read `components/markets/candlestick-chart.tsx` directly for the current, authoritative version.)

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { fetchKlines, type Kline } from "@/lib/binance/rest";
import { useBinanceKline } from "@/lib/binance/ws";

export interface CandlestickChartProps {
  symbol: string;
  interval: string;
}

function toChartPoint(k: Kline) {
  return {
    time: Math.floor(k.openTime / 1000),
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  };
}

export function CandlestickChart({ symbol, interval }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const liveKline = useBinanceKline(symbol, interval);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart: IChartApi = createChart(containerRef.current, {
      height: 420,
      layout: { background: { color: "transparent" } },
    });
    const series = chart.addCandlestickSeries();
    seriesRef.current = series;

    fetchKlines(symbol, interval, 200).then((klines) => {
      series.setData(klines.map(toChartPoint));
    });

    return () => {
      chart.remove();
      seriesRef.current = null;
    };
  }, [symbol, interval]);

  useEffect(() => {
    if (!liveKline || !seriesRef.current) return;
    seriesRef.current.update({
      time: Math.floor(liveKline.openTime / 1000),
      open: liveKline.open,
      high: liveKline.high,
      low: liveKline.low,
      close: liveKline.close,
    } as never);
  }, [liveKline]);

  return <div ref={containerRef} data-testid="candlestick-chart" />;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run components/markets/candlestick-chart.test.tsx`
Expected: PASS

- [ ] **Step 6: Write failing test — `components/markets/chart-panel.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";
import * as rest from "@/lib/binance/rest";

vi.mock("./candlestick-chart", () => ({
  CandlestickChart: ({ symbol, interval }: { symbol: string; interval: string }) => (
    <div data-testid="chart-stub">
      {symbol}-{interval}
    </div>
  ),
}));

import { ChartPanel } from "./chart-panel";

describe("ChartPanel", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 81687.73,
        lowPrice: 78798.97,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
    vi.spyOn(rest, "fetchFundingRate").mockResolvedValue({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260.1,
      indexPrice: 80243.35,
    });
  });

  it("shows the selected symbol's price header and funding rate", async () => {
    renderWithQueryClient(<ChartPanel />);
    await waitFor(() => expect(screen.getByText("80,243.35")).toBeInTheDocument());
    expect(screen.getByText(/24h High 81,687.73/)).toBeInTheDocument();
    expect(screen.getByText(/24h Low 78,798.97/)).toBeInTheDocument();
    expect(screen.getByText(/Funding \+0.01%/)).toBeInTheDocument();
  });

  it("defaults to the 15m timeframe and switches the chart when a tab is clicked", async () => {
    renderWithQueryClient(<ChartPanel />);
    await waitFor(() => expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-15m"));
    fireEvent.click(screen.getByRole("tab", { name: "1h" }));
    expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-1h");
  });

  it("maps the 1D tab label to Binance's lowercase daily interval", async () => {
    renderWithQueryClient(<ChartPanel />);
    await waitFor(() => expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-15m"));
    fireEvent.click(screen.getByRole("tab", { name: "1D" }));
    expect(screen.getByTestId("chart-stub")).toHaveTextContent("BTCUSDT-1d");
  });
});
```

- [ ] **Step 7: Run to verify it fails, then implement `components/markets/chart-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr, fetchFundingRate, type BinanceInterval } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPrice, formatPercent } from "@/lib/format";
import { Tabs } from "@/components/ui/tabs";
import { CandlestickChart } from "./candlestick-chart";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// Binance's kline REST/WS interval parameter is lowercase ("1d", not "1D").
// "1D" is kept as the button label because that's the conventional way
// trading UIs display the daily timeframe.
const BINANCE_INTERVAL: Record<Timeframe, BinanceInterval> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
};

export function ChartPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");

  const { data: ticker } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "chart", selectedSymbol],
    queryFn: async () => (await fetchTicker24hr([selectedSymbol]))[0],
    refetchInterval: 10_000,
  });

  const { data: funding } = useStaleAwareQuery({
    queryKey: ["fundingRate", selectedSymbol],
    queryFn: () => fetchFundingRate(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{symbolInfo.name}</h2>
          <p className="text-2xl font-bold">{ticker ? formatPrice(ticker.lastPrice) : "—"}</p>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>24h High {ticker ? formatPrice(ticker.highPrice) : "—"}</span>
          <span>24h Low {ticker ? formatPrice(ticker.lowPrice) : "—"}</span>
          <span>24h Change {ticker ? formatPercent(ticker.priceChangePercent) : "—"}</span>
          <span>
            Funding{" "}
            {symbolInfo.futuresSymbol === null || !funding
              ? "—"
              : formatPercent(funding.lastFundingRate * 100)}
          </span>
        </div>
        <Tabs value={timeframe} options={TIMEFRAMES} onChange={setTimeframe} />
      </div>
      <CandlestickChart symbol={selectedSymbol} interval={BINANCE_INTERVAL[timeframe]} />
    </div>
  );
}
```

(Note: found via Task 25's real-browser verification, not by the mocked unit tests — Binance's actual kline REST/WS interval parameter rejects `"1D"` (only lowercase `"1d"` is valid), which surfaced as a CORS-looking `net::ERR_FAILED` in the browser network tab when clicking the daily tab, since Binance's error response for a malformed interval doesn't carry CORS headers. Every unit test mocks `fetchKlines`/`useBinanceKline` directly, so none of them ever sent a real interval string to Binance and none could have caught this. Fixed with a `BINANCE_INTERVAL` lookup so the UI keeps the conventional `"1D"` button label while the actual API/stream calls use `"1d"`.

Code review on this fix (commit `a48403b`) then asked whether the fix belonged at the right altitude: `fetchKlines` and `useBinanceKline` both still typed `interval` as a bare `string`, so any future call site could reintroduce the exact same bug, invisibly, since the mocked test suite can't see real Binance rejections. The "obvious" more-general fix — normalizing casing at that lower boundary — would itself have been wrong: Binance's interval enum is case-sensitive in a way that matters (`"1m"` is one minute, `"1M"` is one month; both are valid, distinct values), so a blanket `.toLowerCase()` would silently turn a future monthly-candle request into a minute-candle request instead of failing loudly. The actual fix, added as a follow-up: a `BinanceInterval` literal-union type exported from `lib/binance/rest.ts` and used as the `interval` parameter type on both `fetchKlines` and `useBinanceKline`, so a mismatched call site is now a compile-time TypeScript error rather than a hopeful runtime string. This finding is also recorded in the design spec's "Open questions / risks" section.)

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run components/markets/chart-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add components/markets/candlestick-chart.tsx components/markets/candlestick-chart.test.tsx components/markets/chart-panel.tsx components/markets/chart-panel.test.tsx package.json package-lock.json
git commit -m "feat: add candlestick chart panel with timeframe tabs and funding rate"
```

---

### Task 16: Order book panel

**Files:**
- Create: `components/markets/order-book-panel.tsx`, `components/markets/order-book-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/order-book-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceDepth: () => ({
    bids: [{ price: 80230.03, quantity: 0.7251 }],
    asks: [{ price: 80243.35, quantity: 1.2327 }],
  }),
}));

import { OrderBookPanel } from "./order-book-panel";

describe("OrderBookPanel", () => {
  it("renders bid and ask rows with the right up/down coloring", () => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    render(<OrderBookPanel />);
    expect(screen.getByText("80,230.03")).toHaveClass("text-up");
    expect(screen.getByText("80,243.35")).toHaveClass("text-down");
    expect(screen.getByText("0.7251")).toBeInTheDocument();
    expect(screen.getByText("1.2327")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/order-book-panel.tsx`**

```tsx
"use client";

import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceDepth } from "@/lib/binance/ws";
import { formatPrice } from "@/lib/format";

export function OrderBookPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const depth = useBinanceDepth(selectedSymbol);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-muted-foreground">Order Book</h3>
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Amount</span>
      </div>
      <div className="flex flex-col-reverse gap-0.5">
        {(depth?.asks ?? []).map((level) => (
          <div key={`ask-${level.price}`} className="grid grid-cols-2 text-xs">
            <span className="text-down">{formatPrice(level.price)}</span>
            <span className="text-right">{level.quantity.toFixed(4)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        {(depth?.bids ?? []).map((level) => (
          <div key={`bid-${level.price}`} className="grid grid-cols-2 text-xs">
            <span className="text-up">{formatPrice(level.price)}</span>
            <span className="text-right">{level.quantity.toFixed(4)}</span>
          </div>
        ))}
      </div>
      {!depth && <p className="text-xs text-muted-foreground">Connecting…</p>}
    </div>
  );
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/order-book-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/markets/order-book-panel.tsx components/markets/order-book-panel.test.tsx
git commit -m "feat: add live order book panel"
```

---

### Task 17: Recent trades panel

**Files:**
- Create: `components/markets/recent-trades-panel.tsx`, `components/markets/recent-trades-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/recent-trades-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceTrades: () => [
    { id: 2, price: 80243.35, quantity: 0.9424, time: 1735689600000, isBuyerMaker: false },
    { id: 1, price: 80230.03, quantity: 0.3247, time: 1735689590000, isBuyerMaker: true },
  ],
}));

import { RecentTradesPanel } from "./recent-trades-panel";

describe("RecentTradesPanel", () => {
  it("renders trade rows colored by taker side", () => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
    render(<RecentTradesPanel />);
    expect(screen.getByText("80,243.35")).toHaveClass("text-up");
    expect(screen.getByText("80,230.03")).toHaveClass("text-down");
    expect(screen.getByText("0.9424")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/recent-trades-panel.tsx`**

```tsx
"use client";

import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceTrades } from "@/lib/binance/ws";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RecentTradesPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const trades = useBinanceTrades(selectedSymbol);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-muted-foreground">Recent Trades</h3>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      {trades.length === 0 && <p className="text-xs text-muted-foreground">Connecting…</p>}
      {trades.map((trade) => (
        <div key={trade.id} className="grid grid-cols-3 text-xs">
          <span className={cn(trade.isBuyerMaker ? "text-down" : "text-up")}>
            {formatPrice(trade.price)}
          </span>
          <span className="text-right">{trade.quantity.toFixed(4)}</span>
          <span className="text-right">
            {new Date(trade.time).toLocaleTimeString([], { hour12: false })}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/recent-trades-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/markets/recent-trades-panel.tsx components/markets/recent-trades-panel.test.tsx
git commit -m "feat: add live recent trades panel"
```

---

### Task 18: Extract shared curated-tickers hook

The ticker strip and markets list both fetch the exact same curated 24hr-ticker list, and the upcoming Leaders panel needs it too. Giving each its own query key means three redundant polls against Binance's rate-limited public endpoint every 10s. Extracting one hook lets TanStack Query dedupe them into a single shared request.

**Files:**
- Create: `lib/query/use-curated-tickers.ts`, `lib/query/use-curated-tickers.test.tsx`
- Modify: `components/markets/ticker-strip.tsx`
- Modify: `components/markets/markets-list.tsx`

- [ ] **Step 1: Write failing test — `lib/query/use-curated-tickers.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCuratedTickers } from "./use-curated-tickers";
import * as rest from "@/lib/binance/rest";

describe("useCuratedTickers", () => {
  it("fetches the curated symbol list once and shares it across callers", async () => {
    const fetchMock = vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "BTCUSDT",
        lastPrice: 80243.35,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useCuratedTickers(), { wrapper });
    const second = renderHook(() => useCuratedTickers(), { wrapper });

    await waitFor(() => expect(first.result.current.data).toBeDefined());
    await waitFor(() => expect(second.result.current.data).toBeDefined());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `lib/query/use-curated-tickers.ts`**

```ts
import { useStaleAwareQuery } from "./use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";

export function useCuratedTickers() {
  return useStaleAwareQuery({
    queryKey: ["ticker24hr", "curated"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run lib/query/use-curated-tickers.test.tsx`
Expected: PASS

- [ ] **Step 4: Replace the inline query in `components/markets/ticker-strip.tsx`**

Replace this block:

```tsx
import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchTicker24hr } from "@/lib/binance/rest";
import { CURATED_SYMBOLS } from "@/lib/symbols";
```

and

```tsx
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["ticker24hr", "strip"],
    queryFn: () => fetchTicker24hr(CURATED_SYMBOLS.map((s) => s.symbol)),
    refetchInterval: 10_000,
  });
```

with:

```tsx
import { useCuratedTickers } from "@/lib/query/use-curated-tickers";
import { CURATED_SYMBOLS } from "@/lib/symbols";
```

and

```tsx
  const { data, isLoading, isStale } = useCuratedTickers();
```

- [ ] **Step 5: Replace the inline query in `components/markets/markets-list.tsx`** the same way (swap the `useStaleAwareQuery`/`fetchTicker24hr` import and call for `useCuratedTickers` from `@/lib/query/use-curated-tickers`, keeping the `CURATED_SYMBOLS` import)

- [ ] **Step 6: Re-run the existing tests to confirm the refactor didn't break anything**

Run: `npx vitest run components/markets/ticker-strip.test.tsx components/markets/markets-list.test.tsx lib/query/use-curated-tickers.test.tsx`
Expected: PASS (all previously-passing tests still pass — they mock `fetchTicker24hr` itself, which is unaffected by the refactor)

- [ ] **Step 7: Commit**

```bash
git add lib/query/use-curated-tickers.ts lib/query/use-curated-tickers.test.tsx components/markets/ticker-strip.tsx components/markets/markets-list.tsx
git commit -m "refactor: share one curated-tickers query across strip, list, and leaders"
```

---

### Task 19: Fear & Greed panel

**Files:**
- Create: `components/markets/stat-panels/fear-greed-panel.tsx`, `components/markets/stat-panels/fear-greed-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/stat-panels/fear-greed-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import * as fearGreed from "@/lib/external/fear-greed";
import { FearGreedPanel } from "./fear-greed-panel";

describe("FearGreedPanel", () => {
  it("shows the index value and classification", async () => {
    vi.spyOn(fearGreed, "fetchFearGreed").mockResolvedValue({ value: 68, classification: "Greed" });
    renderWithQueryClient(<FearGreedPanel />);
    await waitFor(() => expect(screen.getByText("68")).toBeInTheDocument());
    expect(screen.getByText("Greed")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/stat-panels/fear-greed-panel.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchFearGreed } from "@/lib/external/fear-greed";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function FearGreedPanel() {
  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["fearGreed"],
    queryFn: fetchFearGreed,
    refetchInterval: 5 * 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fear & Greed Index</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-24" />
        ) : (
          <>
            <p className="text-3xl font-bold">{data?.value}</p>
            <p className="text-sm text-muted-foreground">{data?.classification}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/stat-panels/fear-greed-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/markets/stat-panels/fear-greed-panel.tsx components/markets/stat-panels/fear-greed-panel.test.tsx
git commit -m "feat: add Fear & Greed stat panel"
```

---

### Task 20: Sentiment panel

**Files:**
- Create: `components/markets/stat-panels/sentiment-panel.tsx`, `components/markets/stat-panels/sentiment-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/stat-panels/sentiment-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as rest from "@/lib/binance/rest";
import { SentimentPanel } from "./sentiment-panel";

describe("SentimentPanel", () => {
  it("shows buy/sell percentages derived from the long/short account ratio", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockResolvedValue({ longAccount: 0.64, shortAccount: 0.36 });

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText("64% Buy")).toBeInTheDocument());
    expect(screen.getByText("36% Sell")).toBeInTheDocument();
  });

  it("shows an unavailable message for symbols with no futures contract", async () => {
    useSymbolStore.setState({ selectedSymbol: "PAXGUSDT" });
    const fetchMock = vi.spyOn(rest, "fetchLongShortRatio");

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText(/not available for paxgusdt/i)).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a distinct message when the fetch fails for a futures-backed symbol, not the no-futures message", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<SentimentPanel />);

    await waitFor(() => expect(screen.getByText("Sentiment data unavailable")).toBeInTheDocument());
    expect(screen.queryByText(/not available for btcusdt/i)).not.toBeInTheDocument();
  });
});
```

(Note: originally the `buyPercent === null` branch reused the same "Not available for {symbol}" message as the no-futures-contract branch. Code review found this conflates two different situations — by the time that branch is reached, `futuresSymbol !== null` and `isLoading` is false, so `data === undefined` there can only mean a genuine fetch error with no cached data, not a structural limitation. Reusing the no-futures wording tells the user a futures-backed symbol like BTCUSDT simply has no futures market, which is false. Fixed with a distinct "Sentiment data unavailable" message, locked in by the third test above. Also dropped the unused `beforeEach` import from the original test snippet's import line, since it was never called.)

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/stat-panels/sentiment-panel.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchLongShortRatio } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function SentimentPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;

  const { data, isLoading, isStale } = useStaleAwareQuery({
    queryKey: ["longShortRatio", selectedSymbol],
    queryFn: () => fetchLongShortRatio(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  const buyPercent = data
    ? Math.round((data.longAccount / (data.longAccount + data.shortAccount)) * 100)
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sentiment</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent>
        {symbolInfo.futuresSymbol === null ? (
          <p className="text-sm text-muted-foreground">Not available for {symbolInfo.symbol}</p>
        ) : isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : buyPercent === null ? (
          <p className="text-sm text-muted-foreground">Sentiment data unavailable</p>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-up">{buyPercent}% Buy</span>
            <span className="text-down">{100 - buyPercent}% Sell</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/stat-panels/sentiment-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add components/markets/stat-panels/sentiment-panel.tsx components/markets/stat-panels/sentiment-panel.test.tsx
git commit -m "feat: add Sentiment stat panel"
```

---

### Task 21: Leaders panel

Deliberate scope note: the design spec described this panel as "top gainers/losers," but this task shows only the top 3 gainers, descending, with no losers section. Code review flagged this as worth confirming against the actual bitloom.online reference before treating it as final — left as a simplification here rather than blocking Phase 1 completion on a UX-scope decision. Revisit if/when the dashboard's visual polish gets a dedicated pass.

**Files:**
- Create: `components/markets/stat-panels/leaders-panel.tsx`, `components/markets/stat-panels/leaders-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/stat-panels/leaders-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import * as rest from "@/lib/binance/rest";
import { LeadersPanel } from "./leaders-panel";

describe("LeadersPanel", () => {
  it("shows the top 3 gainers sorted by 24h percent change", async () => {
    vi.spyOn(rest, "fetchTicker24hr").mockResolvedValue([
      {
        symbol: "XAUUSDT",
        lastPrice: 0,
        priceChangePercent: 0.44,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "BTCUSDT",
        lastPrice: 0,
        priceChangePercent: 2.14,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "DOTUSDT",
        lastPrice: 0,
        priceChangePercent: -1.2,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
      {
        symbol: "ETHUSDT",
        lastPrice: 0,
        priceChangePercent: 0.9,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
      },
    ]);

    renderWithQueryClient(<LeadersPanel />);

    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    expect(screen.getByText("XAU")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.queryByText("DOT")).not.toBeInTheDocument();
  });

  it("shows a placeholder instead of an empty card when there is no ticker data", async () => {
    vi.spyOn(rest, "fetchTicker24hr").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<LeadersPanel />);

    await waitFor(() => expect(screen.getByText("No data available")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/stat-panels/leaders-panel.tsx`**

```tsx
"use client";

import { useCuratedTickers } from "@/lib/query/use-curated-tickers";
import { formatPercent } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function LeadersPanel() {
  const { data, isLoading, isStale } = useCuratedTickers();

  const leaders = data ? [...data].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 3) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leaders</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : leaders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available</p>
        ) : (
          leaders.map((ticker) => (
            <div key={ticker.symbol} className="flex items-center justify-between text-sm">
              <span>{ticker.symbol.replace("USDT", "")}</span>
              <span className={ticker.priceChangePercent >= 0 ? "text-up" : "text-down"}>
                {formatPercent(ticker.priceChangePercent)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

(Note: added the `leaders.length === 0` branch so a settled fetch failure with no cached data shows an explicit message instead of a silently empty card body — the same class of gap as Tasks 19/20/22/23, here manifesting as "nothing rendered" rather than a blank value or an infinite skeleton, since `isLoading` was already correctly used to gate the skeleton.)

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/stat-panels/leaders-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/markets/stat-panels/leaders-panel.tsx components/markets/stat-panels/leaders-panel.test.tsx
git commit -m "feat: add Leaders stat panel"
```

---

### Task 22: Session panel (long/short, OI change, basis, spread)

Basis comes from the funding-rate call's mark vs. index price (Task 7). Spread is derived client-side from the live order book depth (Task 9) rather than a new REST call. Open interest 1h change needs one new fetcher.

**Files:**
- Modify: `lib/binance/rest.ts` (append `fetchOpenInterestChange`)
- Modify: `lib/binance/rest.test.ts` (append its test)
- Create: `components/markets/stat-panels/session-panel.tsx`, `components/markets/stat-panels/session-panel.test.tsx`

- [ ] **Step 1: Append a failing test to `lib/binance/rest.test.ts`**

```ts
import { fetchOpenInterestChange } from "./rest";

describe("fetchOpenInterestChange", () => {
  it("computes percent change from the oldest to the newest open-interest sample", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sumOpenInterest: "48000.0" },
          { sumOpenInterest: "48200.0" },
          { sumOpenInterest: "48600.0" },
        ],
      })
    );
    const result = await fetchOpenInterestChange("BTCUSDT");
    expect(result.changePercent).toBeCloseTo(1.25, 2);
  });
});
```

Merge the new `fetchOpenInterestChange` import into the existing `./rest` import at the top of the file.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: FAIL — `fetchOpenInterestChange` is not exported

- [ ] **Step 3: Append implementation to `lib/binance/rest.ts`**

```ts
export interface OpenInterestChange {
  changePercent: number;
}

export async function fetchOpenInterestChange(symbol: string): Promise<OpenInterestChange> {
  const url = `${FUTURES_BASE_URL}/futures/data/openInterestHist?symbol=${encodeURIComponent(
    symbol
  )}&period=5m&limit=13`;
  const data = await fetchBinanceJson<{ sumOpenInterest: string }[]>(url, "openInterestHist");
  if (data.length === 0) throw new Error("Binance openInterestHist failed: empty response");
  const oldest = Number(data[0].sumOpenInterest);
  const newest = Number(data[data.length - 1].sumOpenInterest);
  return { changePercent: ((newest - oldest) / oldest) * 100 };
}
```

(Note: implemented via the file's existing shared `fetchBinanceJson<T>` helper rather than a raw `fetch` call, for consistency with the other 5 fetchers already in this file — same behavior, same error-message format. Also added an empty-response guard matching `fetchLongShortRatio`'s sibling pattern, found missing in code review: without it, Binance ever returning `[]` would throw an unhelpful raw `TypeError` instead of a clear labeled error.)

- [ ] **Step 4: Run to verify all rest.ts tests pass**

Run: `npx vitest run lib/binance/rest.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit the fetcher**

```bash
git add lib/binance/rest.ts lib/binance/rest.test.ts
git commit -m "feat: add open-interest 1h change fetcher"
```

- [ ] **Step 6: Write failing test — `components/markets/stat-panels/session-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as rest from "@/lib/binance/rest";

vi.mock("@/lib/binance/ws", () => ({
  useBinanceDepth: () => ({
    bids: [{ price: 80230, quantity: 1 }],
    asks: [{ price: 80236.42, quantity: 1 }],
  }),
}));

import { SessionPanel } from "./session-panel";

describe("SessionPanel", () => {
  it("shows long/short, OI change, basis, and spread for a futures-backed symbol", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockResolvedValue({ longAccount: 0.58, shortAccount: 0.42 });
    vi.spyOn(rest, "fetchFundingRate").mockResolvedValue({
      symbol: "BTCUSDT",
      lastFundingRate: 0.0001,
      markPrice: 80260,
      indexPrice: 80243.98,
    });
    vi.spyOn(rest, "fetchOpenInterestChange").mockResolvedValue({ changePercent: 1.24 });

    renderWithQueryClient(<SessionPanel />);

    await waitFor(() => expect(screen.getByText("58 / 42")).toBeInTheDocument());
    expect(screen.getByText("+1.24%")).toBeInTheDocument();
    expect(screen.getByText("+0.02%")).toBeInTheDocument();
    expect(screen.getByText(/0\.8 bps/)).toBeInTheDocument();
  });

  it("shows an unavailable message for symbols with no futures contract", () => {
    useSymbolStore.setState({ selectedSymbol: "PAXGUSDT" });
    renderWithQueryClient(<SessionPanel />);
    expect(screen.getByText(/not available for paxgusdt/i)).toBeInTheDocument();
  });

  it("shows placeholders instead of an infinite skeleton when fetches fail with no cached data", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(rest, "fetchLongShortRatio").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchFundingRate").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchOpenInterestChange").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<SessionPanel />);

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(3));
  });
});
```

- [ ] **Step 7: Run to verify it fails, then implement `components/markets/stat-panels/session-panel.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchLongShortRatio, fetchFundingRate, fetchOpenInterestChange } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { useBinanceDepth } from "@/lib/binance/ws";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatPercent } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function SessionPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;
  const hasFutures = symbolInfo.futuresSymbol !== null;
  const depth = useBinanceDepth(selectedSymbol);

  const {
    data: ratio,
    isStale: ratioStale,
    isLoading: ratioLoading,
  } = useStaleAwareQuery({
    queryKey: ["longShortRatio", "session", selectedSymbol],
    queryFn: () => fetchLongShortRatio(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 60_000,
  });

  const {
    data: funding,
    isStale: fundingStale,
    isLoading: fundingLoading,
  } = useStaleAwareQuery({
    queryKey: ["fundingRate", "session", selectedSymbol],
    queryFn: () => fetchFundingRate(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 60_000,
  });

  const {
    data: oiChange,
    isStale: oiStale,
    isLoading: oiLoading,
  } = useStaleAwareQuery({
    queryKey: ["openInterestChange", selectedSymbol],
    queryFn: () => fetchOpenInterestChange(symbolInfo.futuresSymbol as string),
    enabled: hasFutures,
    refetchInterval: 5 * 60_000,
  });

  if (!hasFutures) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Not available for {symbolInfo.symbol}</p>
        </CardContent>
      </Card>
    );
  }

  const longPercent = ratio
    ? Math.round((ratio.longAccount / (ratio.longAccount + ratio.shortAccount)) * 100)
    : null;
  const basisPercent = funding ? ((funding.markPrice - funding.indexPrice) / funding.indexPrice) * 100 : null;
  const bestBid = depth?.bids[0]?.price;
  const bestAsk = depth?.asks[0]?.price;
  const spreadBps = bestBid && bestAsk ? ((bestAsk - bestBid) / bestBid) * 10_000 : null;
  const isStale = ratioStale || fundingStale || oiStale;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Session</CardTitle>
        {isStale && <StaleBadge />}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Long / Short</p>
          {ratioLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {longPercent === null ? "—" : `${longPercent} / ${100 - longPercent}`}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">OI Change 1h</p>
          {oiLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{oiChange ? formatPercent(oiChange.changePercent) : "—"}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Basis</p>
          {fundingLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{basisPercent === null ? "—" : formatPercent(basisPercent)}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spread</p>
          {spreadBps === null ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">{spreadBps.toFixed(1)} bps</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

(Note: originally each field showed `<Skeleton>` indefinitely whenever its value was `null`, without distinguishing "still loading" from "settled with no data" — so a genuine fetch failure with no cached data looked identical to a perpetual loading spinner, forever, rather than a clear failure state. This is the same class of bug found and fixed in Tasks 19/20 [`FearGreedPanel`, `SentimentPanel`], just manifesting as an infinite skeleton instead of a blank card or a mislabeled message. Fixed by destructuring each query's own `isLoading` and using it to choose between `Skeleton` (genuinely loading), `"—"` (settled, no data), and the real value — the `Spread` field is left driven by `useBinanceDepth`, a WebSocket hook with no error/loaded distinction of its own; "still connecting" is the same accepted indefinite state `OrderBookPanel` already uses. A second round of code review then caught that nesting `<Skeleton>` — a `<div>` — inside a `<p>` is invalid HTML, verified by an actual `validateDOMNesting` console warning during the test run, and a real hydration-mismatch risk in a Next.js app since the browser's HTML parser force-closes the `<p>` early. Fixed by moving the `Skeleton`/value branch outside the `<p>` entirely for all four fields, so `Skeleton` and its sibling `<p>` are never nested.)

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run components/markets/stat-panels/session-panel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add components/markets/stat-panels/session-panel.tsx components/markets/stat-panels/session-panel.test.tsx
git commit -m "feat: add Session stat panel"
```

---

### Task 23: Global panel

Total market open interest isn't available from any free source without summing every pair on the exchange, so this panel reports open interest for the *currently selected* futures-backed symbol, clearly labeled — market cap, 24h volume, and BTC dominance come from the CoinGecko proxy and are market-wide.

**Files:**
- Create: `components/markets/stat-panels/global-panel.tsx`, `components/markets/stat-panels/global-panel.test.tsx`

- [ ] **Step 1: Write failing test — `components/markets/stat-panels/global-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import { useSymbolStore } from "@/lib/store/symbol-store";
import * as coingecko from "@/lib/external/coingecko";
import * as rest from "@/lib/binance/rest";
import { GlobalPanel } from "./global-panel";

describe("GlobalPanel", () => {
  it("shows market cap, 24h volume, BTC dominance, and the selected symbol's open interest", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(coingecko, "fetchGlobalStats").mockResolvedValue({
      totalMarketCapUsd: 3_120_000_000_000,
      totalVolumeUsd: 142_800_000_000,
      btcDominance: 54.2,
    });
    vi.spyOn(rest, "fetchOpenInterest").mockResolvedValue({ symbol: "BTCUSDT", openInterest: 48600.12 });

    renderWithQueryClient(<GlobalPanel />);

    await waitFor(() => expect(screen.getByText("$3.12T")).toBeInTheDocument());
    expect(screen.getByText("$142.8B")).toBeInTheDocument();
    expect(screen.getByText("54.20%")).toBeInTheDocument();
    expect(screen.getByText("48,600.12")).toBeInTheDocument();
  });

  it("shows placeholders instead of an infinite skeleton when fetches fail with no cached data", async () => {
    useSymbolStore.setState({ selectedSymbol: "BTCUSDT" });
    vi.spyOn(coingecko, "fetchGlobalStats").mockRejectedValue(new Error("network down"));
    vi.spyOn(rest, "fetchOpenInterest").mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<GlobalPanel />);

    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(4));
  });

  it("shows a placeholder for open interest on symbols with no futures contract, without blocking global stats", async () => {
    useSymbolStore.setState({ selectedSymbol: "PAXGUSDT" });
    vi.spyOn(coingecko, "fetchGlobalStats").mockResolvedValue({
      totalMarketCapUsd: 3_120_000_000_000,
      totalVolumeUsd: 142_800_000_000,
      btcDominance: 54.2,
    });
    const fetchOpenInterestMock = vi.spyOn(rest, "fetchOpenInterest");

    renderWithQueryClient(<GlobalPanel />);

    await waitFor(() => expect(screen.getByText("$3.12T")).toBeInTheDocument());
    expect(fetchOpenInterestMock).not.toHaveBeenCalled();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `components/markets/stat-panels/global-panel.tsx`**

```tsx
"use client";

import { useStaleAwareQuery } from "@/lib/query/use-stale-query";
import { fetchGlobalStats } from "@/lib/external/coingecko";
import { fetchOpenInterest } from "@/lib/binance/rest";
import { useSymbolStore } from "@/lib/store/symbol-store";
import { CURATED_SYMBOLS } from "@/lib/symbols";
import { formatCompact } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "../stale-badge";

export function GlobalPanel() {
  const selectedSymbol = useSymbolStore((s) => s.selectedSymbol);
  const symbolInfo = CURATED_SYMBOLS.find((s) => s.symbol === selectedSymbol)!;

  const {
    data: globalStats,
    isStale: globalStale,
    isLoading: globalLoading,
  } = useStaleAwareQuery({
    queryKey: ["globalStats"],
    queryFn: fetchGlobalStats,
    refetchInterval: 60_000,
  });

  const {
    data: openInterest,
    isStale: oiStale,
    isLoading: oiLoading,
  } = useStaleAwareQuery({
    queryKey: ["openInterest", selectedSymbol],
    queryFn: () => fetchOpenInterest(symbolInfo.futuresSymbol as string),
    enabled: symbolInfo.futuresSymbol !== null,
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Global</CardTitle>
        {(globalStale || oiStale) && <StaleBadge />}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Market Cap</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `$${formatCompact(globalStats.totalMarketCapUsd)}` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">24h Volume</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `$${formatCompact(globalStats.totalVolumeUsd)}` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">BTC Dominance</p>
          {globalLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {globalStats ? `${globalStats.btcDominance.toFixed(2)}%` : "—"}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Open Interest ({symbolInfo.symbol.replace("USDT", "")})
          </p>
          {symbolInfo.futuresSymbol !== null && oiLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <p className="font-semibold">
              {symbolInfo.futuresSymbol === null
                ? "—"
                : openInterest
                  ? openInterest.openInterest.toLocaleString("en-US")
                  : "—"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

(Note: same infinite-skeleton-on-error fix as Task 22 — each field now checks its own `isLoading` before falling back to a `Skeleton`, so a settled fetch failure with no cached data shows `"—"` instead of spinning forever. Also applies Task 22's second fix up front: `Skeleton` — a `<div>` — is never nested inside a `<p>`, since that's invalid HTML and a real hydration-mismatch risk in Next.js, confirmed via an actual console warning when Task 22 had the same structure.)

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run components/markets/stat-panels/global-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/markets/stat-panels/global-panel.tsx components/markets/stat-panels/global-panel.test.tsx
git commit -m "feat: add Global stat panel"
```

---

### Task 24: Compose the markets dashboard page

Every child panel is already unit-tested against its own data; this test only verifies the page wires all ten of them together, so it mocks each panel component (shallow) rather than every underlying fetcher again.

**Files:**
- Modify: `app/page.tsx` (replace the Task 1 placeholder)
- Create: `app/page.test.tsx`

- [ ] **Step 1: Write failing test — `app/page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/markets/ticker-strip", () => ({ TickerStrip: () => <div data-testid="ticker-strip" /> }));
vi.mock("@/components/markets/markets-list", () => ({ MarketsList: () => <div data-testid="markets-list" /> }));
vi.mock("@/components/markets/chart-panel", () => ({ ChartPanel: () => <div data-testid="chart-panel" /> }));
vi.mock("@/components/markets/order-book-panel", () => ({
  OrderBookPanel: () => <div data-testid="order-book-panel" />,
}));
vi.mock("@/components/markets/recent-trades-panel", () => ({
  RecentTradesPanel: () => <div data-testid="recent-trades-panel" />,
}));
vi.mock("@/components/markets/stat-panels/fear-greed-panel", () => ({
  FearGreedPanel: () => <div data-testid="fear-greed-panel" />,
}));
vi.mock("@/components/markets/stat-panels/sentiment-panel", () => ({
  SentimentPanel: () => <div data-testid="sentiment-panel" />,
}));
vi.mock("@/components/markets/stat-panels/leaders-panel", () => ({
  LeadersPanel: () => <div data-testid="leaders-panel" />,
}));
vi.mock("@/components/markets/stat-panels/session-panel", () => ({
  SessionPanel: () => <div data-testid="session-panel" />,
}));
vi.mock("@/components/markets/stat-panels/global-panel", () => ({
  GlobalPanel: () => <div data-testid="global-panel" />,
}));

import Home from "./page";

describe("Home (markets dashboard page)", () => {
  it("composes every dashboard panel", () => {
    render(<Home />);
    for (const testId of [
      "ticker-strip",
      "markets-list",
      "chart-panel",
      "order-book-panel",
      "recent-trades-panel",
      "fear-greed-panel",
      "sentiment-panel",
      "leaders-panel",
      "session-panel",
      "global-panel",
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — the placeholder `Home` from Task 1 doesn't render any of these panels

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import { TickerStrip } from "@/components/markets/ticker-strip";
import { MarketsList } from "@/components/markets/markets-list";
import { ChartPanel } from "@/components/markets/chart-panel";
import { OrderBookPanel } from "@/components/markets/order-book-panel";
import { RecentTradesPanel } from "@/components/markets/recent-trades-panel";
import { FearGreedPanel } from "@/components/markets/stat-panels/fear-greed-panel";
import { SentimentPanel } from "@/components/markets/stat-panels/sentiment-panel";
import { LeadersPanel } from "@/components/markets/stat-panels/leaders-panel";
import { SessionPanel } from "@/components/markets/stat-panels/session-panel";
import { GlobalPanel } from "@/components/markets/stat-panels/global-panel";

export default function Home() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <TickerStrip />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_280px]">
        <aside className="order-2 lg:order-1">
          <MarketsList />
        </aside>
        <section className="order-1 lg:order-2">
          <ChartPanel />
        </section>
        <aside className="order-3 flex flex-col gap-4">
          <OrderBookPanel />
          <RecentTradesPanel />
        </aside>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FearGreedPanel />
        <SentimentPanel />
        <LeadersPanel />
        <SessionPanel />
        <GlobalPanel />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — every test file written across Tasks 2–24 passes

- [ ] **Step 6: Verify the production build still compiles**

Run: `npm run build`
Expected: build completes with no errors

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: compose the markets dashboard page"
```

---

### Task 25: Manual browser verification

Live WebSocket behavior, real Binance/CoinGecko/alternative.me responses, and visual fidelity against the reference screenshots can't be verified by the test suite — this task drives the running app in a real browser, per the design spec's Testing section.

**Files:** none (verification only; fix forward in the relevant task's files if something's broken, then re-run this task)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (leave running)

- [ ] **Step 2: Open the app and confirm dark mode renders correctly**

Navigate to `http://localhost:3000`. Confirm: nav with all 7 links, no sign-in/sign-up button anywhere, ticker strip populated with real prices for the 10 curated symbols (including PAXGUSDT labeled "Gold"), markets list on the left with live prices, a candlestick chart in the center actually drawing candles, order book and recent trades updating in real time on the right, and all five bottom stat panels (Fear & Greed, Sentiment, Leaders, Session, Global) showing real numbers within a few seconds.

- [ ] **Step 3: Check the browser console and network tab**

No uncaught errors in the console. Confirm WebSocket connections to `stream.binance.com` are open (Network tab, WS filter) and REST calls to Binance/CoinGecko/alternative.me return 200s.

- [ ] **Step 4: Exercise symbol selection**

Click a different market card (e.g. ETHUSDT). Confirm the chart header, chart itself, order book, recent trades, sentiment, and session panels all update to the new symbol. Click PAXGUSDT ("Gold") and confirm Sentiment/Session gracefully show "Not available for PAXGUSDT" instead of erroring, since it has no futures contract.

- [ ] **Step 5: Exercise the timeframe tabs**

Click through 1m/5m/15m/1h/4h/1D on the chart panel. Confirm the chart redraws for each interval without console errors.

- [ ] **Step 6: Toggle light mode**

Click the theme toggle in the nav. Confirm every panel re-themes correctly (readable contrast, no invisible text, borders/badges still legible) and the choice persists across a page reload (`localStorage`).

- [ ] **Step 7: Visit each placeholder route**

Navigate to `/trade-desk`, `/portfolio`, `/strategies`, `/analyzer`, `/news`, `/company`. Confirm each shows the "coming in a later phase" placeholder instead of a 404, with the nav and footer still present.

- [ ] **Step 8: Fix forward if anything's broken**

If any check above fails, fix it in the relevant component from Tasks 1–24, re-run that task's test file, and repeat this task's browser check before continuing.

- [ ] **Step 9: Stop the dev server and do a final commit if any fixes were made**

If Step 8 required changes:

```bash
git add -A
git commit -m "fix: address issues found in manual browser verification"
```

If no changes were needed, this task requires no commit.

---

## Plan Self-Review

**Spec coverage:** every element of the approved design spec is implemented — app shell/nav/no-auth (Task 11), theme toggle (Task 11), ticker strip (Task 13), markets list (Task 14), candlestick chart with timeframe tabs (Task 15), order book (Task 16), recent trades (Task 17), Fear & Greed / Sentiment / Leaders / Session / Global panels (Tasks 19–23), footer (Task 11), stale-data fallback (`useStaleAwareQuery`, used by every data-driven panel), skeleton loading states (every panel), and the funding-rate data-source fix from the spec's self-review (Task 15). PAXGUSDT/Gold handling is covered in Tasks 5, 15, 20, 22, 23. The spec's two flagged risks (Binance geo-blocking, CoinGecko rate limits) are structural/deployment concerns with no code action for this phase — carried forward as known risks, not gaps.

**Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code or an exact command with expected output.

**Type consistency:** `FundingRate` (Task 7, retrofitted before Task 22 used it) carries `markPrice`/`indexPrice` consistently everywhere it's constructed or mocked (Tasks 7, 15, 22). `SymbolInfo.futuresSymbol: string | null` is checked consistently (`=== null` / `!== null`) in every panel that branches on it (Tasks 15, 20, 22, 23). `useStaleAwareQuery`'s `{ data, isStale, isLoading }` shape (Task 10) is used identically by every panel that calls it.

