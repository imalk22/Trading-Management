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
    <>
      <input
        aria-label="entry-stub"
        value={values.entryPrice}
        onChange={(e) => onChange({ ...values, entryPrice: e.target.value })}
      />
      <input
        aria-label="tp-stub"
        value={values.takeProfitPrice}
        onChange={(e) => onChange({ ...values, takeProfitPrice: e.target.value })}
      />
      <input
        aria-label="sl-stub"
        value={values.stopLossPrice}
        onChange={(e) => onChange({ ...values, stopLossPrice: e.target.value })}
      />
    </>
  ),
}));
vi.mock("@/components/analyzer/trade-summary-panel", () => ({
  TradeSummaryPanel: ({
    entryPrice,
    accountBalance,
    riskPercent,
  }: {
    entryPrice: number | null;
    accountBalance: number;
    riskPercent: number;
  }) => <div data-testid="summary-stub">{JSON.stringify({ entryPrice, accountBalance, riskPercent })}</div>,
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
    expect(screen.getByTestId("summary-stub")).toHaveTextContent('"entryPrice":null');
    expect(screen.getByTestId("alignment-stub")).toHaveTextContent("invalid");

    fireEvent.change(screen.getByLabelText("entry-stub"), { target: { value: "100" } });
    expect(screen.getByTestId("summary-stub")).toHaveTextContent('"entryPrice":100');
  });

  it("infers a valid long direction and passes account settings through once entry/TP/SL are all filled in", () => {
    renderWithQueryClient(<AnalyzerPage />);

    fireEvent.change(screen.getByLabelText("entry-stub"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("tp-stub"), { target: { value: "110" } });
    fireEvent.change(screen.getByLabelText("sl-stub"), { target: { value: "95" } });

    expect(screen.getByTestId("alignment-stub")).toHaveTextContent("long");
    expect(screen.getByTestId("summary-stub")).toHaveTextContent(
      JSON.stringify({ entryPrice: 100, accountBalance: 10000, riskPercent: 1 })
    );
  });
});
