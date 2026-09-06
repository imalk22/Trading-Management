import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeInputForm, type TradeFormValues } from "./trade-input-form";

const baseValues: TradeFormValues = {
  symbol: "BTCUSDT",
  entryPrice: "100",
  takeProfitPrice: "110",
  stopLossPrice: "95",
};

describe("TradeInputForm", () => {
  it("renders the current values and calls onChange when the entry price is edited", () => {
    const onChange = vi.fn();
    render(
      <TradeInputForm
        values={baseValues}
        onChange={onChange}
        accountBalance={10000}
        onAccountBalanceChange={vi.fn()}
        riskPercent={1}
        onRiskPercentChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "105" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseValues, entryPrice: "105" });
  });

  it("calls onAccountBalanceChange and onRiskPercentChange when those fields are edited", () => {
    const onAccountBalanceChange = vi.fn();
    const onRiskPercentChange = vi.fn();
    render(
      <TradeInputForm
        values={baseValues}
        onChange={vi.fn()}
        accountBalance={10000}
        onAccountBalanceChange={onAccountBalanceChange}
        riskPercent={1}
        onRiskPercentChange={onRiskPercentChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Account Balance ($)"), { target: { value: "20000" } });
    expect(onAccountBalanceChange).toHaveBeenCalledWith(20000);

    fireEvent.change(screen.getByLabelText("Risk Per Trade (%)"), { target: { value: "2" } });
    expect(onRiskPercentChange).toHaveBeenCalledWith(2);
  });

  it("lists every curated symbol as an option", () => {
    render(
      <TradeInputForm
        values={baseValues}
        onChange={vi.fn()}
        accountBalance={10000}
        onAccountBalanceChange={vi.fn()}
        riskPercent={1}
        onRiskPercentChange={vi.fn()}
      />
    );
    expect(screen.getByRole("option", { name: "Bitcoin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ethereum" })).toBeInTheDocument();
  });
});
