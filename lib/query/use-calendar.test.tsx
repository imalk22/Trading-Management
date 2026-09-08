import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCalendar } from "./use-calendar";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCalendar", () => {
  it("fetches from /api/calendar and returns the events array", async () => {
    const events = [
      {
        id: "USD-2026-09-09T14:00:00-04:00-FOMC Statement",
        title: "FOMC Statement",
        country: "USD",
        date: "2026-09-09T14:00:00-04:00",
        impact: "High",
        forecast: "",
        previous: "",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ events }) } as Response))
    );

    const { result } = renderHook(() => useCalendar(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(events));
    expect(fetch).toHaveBeenCalledWith("/api/calendar");

    vi.unstubAllGlobals();
  });
});
