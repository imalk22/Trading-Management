import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSymbolStore } from "./symbol-store";
import { DEFAULT_SYMBOL } from "@/lib/symbols";

describe("useSymbolStore", () => {
  beforeEach(() => {
    useSymbolStore.setState({ selectedSymbol: DEFAULT_SYMBOL });
  });

  it("defaults to the default symbol", () => {
    const { result } = renderHook(() => useSymbolStore());
    expect(result.current.selectedSymbol).toBe(DEFAULT_SYMBOL);
  });

  it("updates the selected symbol", () => {
    const { result } = renderHook(() => useSymbolStore());
    act(() => result.current.selectSymbol("ETHUSDT"));
    expect(result.current.selectedSymbol).toBe("ETHUSDT");
  });
});
