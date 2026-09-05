import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("toggles the document theme class when clicked", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
  });
});
