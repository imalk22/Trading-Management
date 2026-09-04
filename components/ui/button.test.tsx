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
