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
});
