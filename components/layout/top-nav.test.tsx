import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { TopNav } from "./top-nav";

function renderNav() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TopNav />
    </ThemeProvider>
  );
}

describe("TopNav", () => {
  it("links to every section, including not-yet-built phases", () => {
    renderNav();
    const expected: Record<string, string> = {
      Markets: "/",
      "Trade Desk": "/trade-desk",
      Portfolio: "/portfolio",
      Strategies: "/strategies",
      Analyzer: "/analyzer",
      News: "/news",
      Company: "/company",
    };
    for (const [label, href] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("has no sign-in or sign-up affordance", () => {
    renderNav();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
  });

  it("renders a markets search input", () => {
    renderNav();
    expect(screen.getByPlaceholderText(/search markets/i)).toBeInTheDocument();
  });
});
