import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const RAW_EVENTS = [
  { title: "FOMC Statement", country: "USD", date: "2026-09-09T14:00:00-04:00", impact: "High", forecast: "", previous: "" },
  { title: "CPI m/m", country: "USD", date: "2026-09-10T08:30:00-04:00", impact: "Medium", forecast: "0.2%", previous: "0.3%" },
  { title: "Bank Holiday", country: "CAD", date: "2026-09-07T08:00:00-04:00", impact: "Holiday", forecast: "", previous: "" },
];

function mockFetchOk(body: unknown) {
  return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response));
}

function mockFetchFail() {
  return vi.fn(() => Promise.resolve({ ok: false, status: 502 } as Response));
}

describe("GET /api/calendar", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes and returns events from the feed", async () => {
    vi.stubGlobal("fetch", mockFetchOk(RAW_EVENTS));

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.events).toHaveLength(3);
    expect(body.events[0]).toEqual({
      id: "USD-2026-09-09T14:00:00-04:00-FOMC Statement",
      title: "FOMC Statement",
      country: "USD",
      date: "2026-09-09T14:00:00-04:00",
      impact: "High",
      forecast: "",
      previous: "",
    });
  });

  it("skips a malformed event (unparseable date) without failing the rest", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk([
        { title: "Broken Event", country: "USD", date: "not-a-date", impact: "High", forecast: "", previous: "" },
        ...RAW_EVENTS,
      ])
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.events).toHaveLength(3);
    expect(body.events.some((e: { title: string }) => e.title === "Broken Event")).toBe(false);
  });

  it("returns an empty events array, not an error, when the fetch fails", async () => {
    vi.stubGlobal("fetch", mockFetchFail());

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.events).toEqual([]);
  });

  it("does not cache a total-failure result, so the next call re-fetches", async () => {
    vi.stubGlobal("fetch", mockFetchFail());

    const { GET } = await import("./route");
    const firstResponse = await GET();
    const firstBody = await firstResponse.json();
    expect(firstBody.events).toEqual([]);

    const recoveredFetchMock = mockFetchOk(RAW_EVENTS);
    vi.stubGlobal("fetch", recoveredFetchMock);

    const secondResponse = await GET();
    const secondBody = await secondResponse.json();

    expect(recoveredFetchMock).toHaveBeenCalledTimes(1);
    expect(secondBody.events).toHaveLength(3);
  });

  it("serves a cached response on a second call within the TTL without re-fetching", async () => {
    const fetchMock = mockFetchOk(RAW_EVENTS);
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET();
    const callCountAfterFirst = fetchMock.mock.calls.length;
    await GET();
    const callCountAfterSecond = fetchMock.mock.calls.length;

    expect(callCountAfterFirst).toBe(1);
    expect(callCountAfterSecond).toBe(1);
  });
});
