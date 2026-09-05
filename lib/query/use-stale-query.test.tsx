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
});
