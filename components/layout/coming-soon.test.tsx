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
