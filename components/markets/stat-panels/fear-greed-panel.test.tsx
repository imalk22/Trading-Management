import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient } from "@/lib/test-utils";
import * as fearGreed from "@/lib/external/fear-greed";
import { FearGreedPanel } from "./fear-greed-panel";

describe("FearGreedPanel", () => {
  it("shows the index value and classification", async () => {
    vi.spyOn(fearGreed, "fetchFearGreed").mockResolvedValue({ value: 68, classification: "Greed" });
    renderWithQueryClient(<FearGreedPanel />);
    await waitFor(() => expect(screen.getByText("68")).toBeInTheDocument());
    expect(screen.getByText("Greed")).toBeInTheDocument();
  });

  it("shows a placeholder instead of a blank card when the query errors with no cached data", async () => {
    vi.spyOn(fearGreed, "fetchFearGreed").mockRejectedValue(new Error("network down"));
    renderWithQueryClient(<FearGreedPanel />);
    await waitFor(() => expect(screen.getAllByText("—").length).toBe(2));
  });
});
