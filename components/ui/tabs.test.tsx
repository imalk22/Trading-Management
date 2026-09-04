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
