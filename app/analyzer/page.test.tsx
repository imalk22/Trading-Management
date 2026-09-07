import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import type { TradeFormValues } from "@/components/analyzer/trade-input-form";

vi.mock("@/components/analyzer/trade-input-form", () => ({
  TradeInputForm: ({
    values,
    onChange,
  }: {
    values: TradeFormValues;
    onChange: (v: TradeFormValues) => void;
  }) => (
    <input aria-label="entry-stub" value={values.entryPrice} onChange={(e) => onChange({ ...values, entryPrice: e.target.value })} />
  ),
}));
vi.mock("@/components/analyzer/trade-summary-panel", () => ({
  TradeSummaryPanel: ({ entryPrice }: { entryPrice: number | null }) => (
    <div data-testid="summary-stub">{String(entryPrice)}</div>
  ),
}));
vi.mock("@/components/analyzer/strategy-alignment-panel", () => ({
  StrategyAlignmentPanel: ({ direction }: { direction: string }) => (
    <div data-testid="alignment-stub">{direction}</div>
  ),
}));

import AnalyzerPage from "./page";

describe("AnalyzerPage", () => {
  it("renders the title and both analysis panels, wiring form state through to them", () => {
    renderWithQueryClient(<AnalyzerPage />);

    expect(screen.getByRole("heading", { name: "Trade Analyzer" })).toBeInTheDocument();
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("null");
    expect(screen.getByTestId("alignment-stub")).toHaveTextContent("invalid");

    fireEvent.change(screen.getByLabelText("entry-stub"), { target: { value: "100" } });
    expect(screen.getByTestId("summary-stub")).toHaveTextContent("100");
  });
});
