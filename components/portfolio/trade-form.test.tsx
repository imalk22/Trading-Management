import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradeForm } from "./trade-form";

describe("TradeForm", () => {
  it("submits a fully-filled trade with the correct parsed shape", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Stop Loss (optional)"), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText("Take Profit (optional)"), { target: { value: "110" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Breakout play" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      direction: "long",
      entryPrice: 100,
      stopLossPrice: 95,
      takeProfitPrice: 110,
      units: 2,
      notes: "Breakout play",
    });
  });

  it("submits with null stop-loss and take-profit when left empty", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ stopLossPrice: null, takeProfitPrice: null })
    );
  });

  it("switches direction to short when the Short button is clicked", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Short" }));
    fireEvent.change(screen.getByLabelText("Entry Price"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ direction: "short" }));
  });

  it("does not submit when entry price or units is missing", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when entry price is blank even if units is filled in", () => {
    const onSubmit = vi.fn();
    render(<TradeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log Trade" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
