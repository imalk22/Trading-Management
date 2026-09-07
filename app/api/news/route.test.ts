import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const COINDESK_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>CoinDesk Article</title>
  <link>https://www.coindesk.com/a1</link>
  <pubDate>Mon, 07 Sep 2026 12:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const COINTELEGRAPH_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>Cointelegraph Article</title>
  <link>https://cointelegraph.com/a1</link>
  <pubDate>Mon, 07 Sep 2026 13:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const DECRYPT_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>Decrypt Article</title>
  <link>https://decrypt.co/a1</link>
  <pubDate>Mon, 07 Sep 2026 11:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

const THE_BLOCK_XML = `<?xml version="1.0"?><rss><channel><item>
  <title>The Block Article</title>
  <link>https://www.theblock.co/a1</link>
  <pubDate>Mon, 07 Sep 2026 10:00:00 +0000</pubDate>
  <description>desc</description>
</item></channel></rss>`;

function mockFetchByUrl(responses: Record<string, { ok: boolean; text?: string }>) {
  return vi.fn((url: string) => {
    const match = Object.entries(responses).find(([key]) => url.includes(key));
    if (!match) return Promise.reject(new Error(`Unexpected URL: ${url}`));
    const [, response] = match;
    if (!response.ok) return Promise.resolve({ ok: false, status: 502 } as Response);
    return Promise.resolve({ ok: true, text: () => Promise.resolve(response.text!) } as Response);
  });
}

describe("GET /api/news", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges all four feeds and sorts by publish time, newest first", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: true, text: COINDESK_XML },
        "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
        "decrypt.co": { ok: true, text: DECRYPT_XML },
        "theblock.co": { ok: true, text: THE_BLOCK_XML },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.articles).toHaveLength(4);
    expect(body.articles.map((a: { source: string }) => a.source)).toEqual([
      "Cointelegraph",
      "CoinDesk",
      "Decrypt",
      "The Block",
    ]);
  });

  it("still returns the other sources' articles when one source's fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: false },
        "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
        "decrypt.co": { ok: true, text: DECRYPT_XML },
        "theblock.co": { ok: true, text: THE_BLOCK_XML },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body.articles).toHaveLength(3);
    expect(body.articles.some((a: { source: string }) => a.source === "CoinDesk")).toBe(false);
  });

  it("returns an empty articles array, not an error, when every source fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchByUrl({
        "coindesk.com": { ok: false },
        "cointelegraph.com": { ok: false },
        "decrypt.co": { ok: false },
        "theblock.co": { ok: false },
      })
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.articles).toEqual([]);
  });

  it("serves a cached response on a second call within the TTL without re-fetching", async () => {
    const fetchMock = mockFetchByUrl({
      "coindesk.com": { ok: true, text: COINDESK_XML },
      "cointelegraph.com": { ok: true, text: COINTELEGRAPH_XML },
      "decrypt.co": { ok: true, text: DECRYPT_XML },
      "theblock.co": { ok: true, text: THE_BLOCK_XML },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET();
    const callCountAfterFirst = fetchMock.mock.calls.length;
    await GET();
    const callCountAfterSecond = fetchMock.mock.calls.length;

    expect(callCountAfterFirst).toBe(4);
    expect(callCountAfterSecond).toBe(4);
  });
});
