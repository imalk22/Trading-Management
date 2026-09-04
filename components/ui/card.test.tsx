import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardContent } from "./card";

describe("Card", () => {
  it("renders title and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Fear & Greed</CardTitle>
        </CardHeader>
        <CardContent>68</CardContent>
      </Card>
    );
    expect(screen.getByText("Fear & Greed")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
  });
});
