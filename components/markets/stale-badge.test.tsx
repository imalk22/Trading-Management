import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaleBadge } from "./stale-badge";

describe("StaleBadge", () => {
  it("renders a Stale label", () => {
    render(<StaleBadge />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
