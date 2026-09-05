import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStaleAwareQuery } from "./use-stale-query";

describe("useStaleAwareQuery", () => {
  it("returns fresh data once the query succeeds", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["test"], queryFn: async () => "fresh" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("fresh"));
    expect(result.current.isStale).toBe(false);
  });

  it("keeps the last good data and flags isStale when a refetch errors", async () => {
    let callCount = 0;
    const queryFn = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) return "fresh";
      throw new Error("network down");
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["test"], queryFn, staleTime: 0 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("fresh"));

    await client.refetchQueries({ queryKey: ["test"] });
    rerender();

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.data).toBe("fresh");
  });

  it("does not carry stale data across a query key change", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    let symbol = "BTC";
    const queryFn = vi.fn(async () => (symbol === "BTC" ? "btc-data" : "eth-data"));

    const { result, rerender } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["symbol", symbol], queryFn }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("btc-data"));

    symbol = "ETH";
    rerender();

    expect(result.current.data).toBeUndefined();
    expect(result.current.isStale).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.data).toBe("eth-data"));
  });

  it("treats a previously-seen key as fresh again on a same-mount round trip", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    let symbol: "BTC" | "ETH" = "BTC";
    const queryFn = vi.fn(async () => (symbol === "BTC" ? "btc-data" : "eth-data"));

    const { result, rerender } = renderHook(
      () => useStaleAwareQuery({ queryKey: ["symbol", symbol], queryFn }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("btc-data"));

    symbol = "ETH";
    rerender();
    await waitFor(() => expect(result.current.data).toBe("eth-data"));

    symbol = "BTC";
    rerender();

    await waitFor(() => expect(result.current.data).toBe("btc-data"));
    expect(result.current.isStale).toBe(false);
  });
});
