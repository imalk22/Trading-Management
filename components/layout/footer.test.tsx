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
