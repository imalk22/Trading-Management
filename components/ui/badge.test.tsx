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
