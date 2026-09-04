import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder block", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
