import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useNews } from "./use-news";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNews", () => {
  it("fetches from /api/news and returns the articles array", async () => {
    const articles = [
      {
        id: "https://example.com/a1",
        title: "Test Article",
        link: "https://example.com/a1",
        source: "CoinDesk",
        publishedAt: Date.now(),
        summary: "summary",
        imageUrl: null,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ articles }) } as Response))
    );

    const { result } = renderHook(() => useNews(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(articles));
    expect(fetch).toHaveBeenCalledWith("/api/news");

    vi.unstubAllGlobals();
  });
});
