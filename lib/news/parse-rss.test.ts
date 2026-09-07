import { describe, it, expect } from "vitest";
import { parseRssFeed } from "./parse-rss";

describe("parseRssFeed", () => {
  it("parses a CoinDesk-style item using media:content for its image, with a CDATA title", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title><![CDATA[Solana to triple transaction size as apps get room for more complex trades]]></title>
  <link>https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size</link>
  <media:content url="https://cdn.sanity.io/images/example/solana.png" type="image/*" medium="image"/>
  <guid isPermaLink="false">439b6a6f-5bd3-4e01-8707-8ac28ef798af</guid>
  <pubDate>Mon, 07 Sep 2026 12:08:11 +0000</pubDate>
  <description><![CDATA[A Transaction v1 feature activates Wednesday, allowing complex proofs to fit in one transaction.]]></description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "CoinDesk");

    expect(articles).toHaveLength(1);
    expect(articles[0]).toEqual({
      id: "https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size",
      title: "Solana to triple transaction size as apps get room for more complex trades",
      link: "https://www.coindesk.com/tech/2026/09/07/solana-to-triple-transaction-size",
      source: "CoinDesk",
      publishedAt: Date.parse("Mon, 07 Sep 2026 12:08:11 +0000"),
      summary: "A Transaction v1 feature activates Wednesday, allowing complex proofs to fit in one transaction.",
      imageUrl: "https://cdn.sanity.io/images/example/solana.png",
    });
  });

  it("parses a Cointelegraph-style item, preferring media:content over the also-present enclosure and inline description image", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Zcash hits highest price since 2016 as market cap tops $20B</title>
  <pubDate>Mon, 07 Sep 2026 12:31:23 +0000</pubDate>
  <guid isPermaLink="true">https://cointelegraph.com/markets/zcash-highest-price</guid>
  <link><![CDATA[https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed]]></link>
  <description><![CDATA[<p style="float:right;"><img src="https://s3-images.ctmedia.io/media/zcash-inline.jpg" alt="Zcash"></p><p>ZEC gained 45% over the past week.</p>]]></description>
  <media:content url="https://s3-images.ctmedia.io/media/zcash-rally.jpg" width="528" medium="image"/>
  <enclosure url="https://s3-images.ctmedia.io/media/zcash-rally.jpg" length="528" type="image/jpeg"/>
  <category>Markets</category>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Cointelegraph");

    expect(articles).toHaveLength(1);
    expect(articles[0].imageUrl).toBe("https://s3-images.ctmedia.io/media/zcash-rally.jpg");
    expect(articles[0].link).toBe("https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed");
    expect(articles[0].id).toBe("https://cointelegraph.com/markets/zcash-highest-price?utm_source=rss_feed");
    expect(articles[0].summary).toBe("ZEC gained 45% over the past week.");
  });

  it("parses a Decrypt-style item with a plain (non-CDATA) title, falling back to enclosure when media:content is absent", () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Irish Gangs Are Renting Private Vaults to Hide Crypto Keys</title>
  <link>https://decrypt.co/377546/irish-gangs-are-renting-private-vaults</link>
  <pubDate>Mon, 07 Sep 2026 12:43:50 +0000</pubDate>
  <description>Keys are going into rented boxes alongside cash, watches and passports.</description>
  <guid isPermaLink="false">https://decrypt.co/?p=377546</guid>
  <enclosure url="https://img.decrypt.co/insecure/rs:fill/vault-decrypt.jpg" length="1000000" type="image/jpeg"/>
  <media:thumbnail url="https://cdn.decrypt.co/wp-content/uploads/vault-decrypt.jpg" height="1080" width="1920"/>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Decrypt");

    expect(articles).toHaveLength(1);
    expect(articles[0].imageUrl).toBe("https://img.decrypt.co/insecure/rs:fill/vault-decrypt.jpg");
    expect(articles[0].title).toBe("Irish Gangs Are Renting Private Vaults to Hide Crypto Keys");
  });

  it("falls back to media:thumbnail when neither media:content nor enclosure is present", () => {
    const xml = `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item>
  <title>Only thumbnail available</title>
  <link>https://example.com/thumb-only</link>
  <pubDate>Mon, 07 Sep 2026 10:00:00 +0000</pubDate>
  <description>desc</description>
  <media:thumbnail url="https://example.com/thumb.jpg" height="1080" width="1920"/>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBe("https://example.com/thumb.jpg");
  });

  it("falls back to the first inline <img> in the description when no media tag is present", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>No media tags, only inline image</title>
  <link>https://example.com/inline-only</link>
  <pubDate>Mon, 07 Sep 2026 09:00:00 +0000</pubDate>
  <description><![CDATA[<p><img src="https://example.com/inline.jpg" alt="x"></p><p>Some text here.</p>]]></description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBe("https://example.com/inline.jpg");
    expect(articles[0].summary).toBe("Some text here.");
  });

  it("returns null imageUrl when no image is found anywhere, without throwing", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>No image at all</title>
  <link>https://example.com/no-image</link>
  <pubDate>Mon, 07 Sep 2026 08:00:00 +0000</pubDate>
  <description>Plain text description, no markup.</description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles[0].imageUrl).toBeNull();
    expect(articles[0].summary).toBe("Plain text description, no markup.");
  });

  it("returns an empty array for a feed with no items, without throwing", () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>Empty Feed</title></channel></rss>`;
    expect(parseRssFeed(xml, "Test Source")).toEqual([]);
  });

  it("skips a malformed item that's missing a link, rather than failing the whole feed", () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>Missing link, should be skipped</title>
  <pubDate>Mon, 07 Sep 2026 07:00:00 +0000</pubDate>
  <description>desc</description>
</item>
<item>
  <title>Valid item</title>
  <link>https://example.com/valid</link>
  <pubDate>Mon, 07 Sep 2026 07:30:00 +0000</pubDate>
  <description>desc</description>
</item>
</channel></rss>`;

    const articles = parseRssFeed(xml, "Test Source");

    expect(articles).toHaveLength(1);
    expect(articles[0].link).toBe("https://example.com/valid");
  });
});
