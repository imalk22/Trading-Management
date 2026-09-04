import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchFearGreed } from "./fear-greed";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFearGreed", () => {
  it("returns the latest index value and classification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ value: "68", value_classification: "Greed", timestamp: "1735689600" }],
        }),
      })
    );

    const result = await fetchFearGreed();

    expect(result).toEqual({ value: 68, classification: "Greed" });
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchFearGreed()).rejects.toThrow("503");
  });
});
