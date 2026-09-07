import { XMLParser } from "fast-xml-parser";
import type { NewsArticle } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "item",
  htmlEntities: true,
});

interface RawItem {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  pubDate?: unknown;
  description?: unknown;
  "media:content"?: { "@_url"?: string };
  "media:thumbnail"?: { "@_url"?: string };
  enclosure?: { "@_url"?: string };
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>)["#text"] === "string") {
    return (value as Record<string, unknown>)["#text"] as string;
  }
  return "";
}

function extractInlineImage(description: string): string | null {
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html.replace(/<\/?[a-zA-Z!][^>]*>/g, "").trim();
}

function extractImageUrl(item: RawItem, description: string): string | null {
  if (item["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  if (item.enclosure?.["@_url"]) return item.enclosure["@_url"];
  if (item["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  return extractInlineImage(description);
}

export function parseRssFeed(xml: string, sourceName: string): NewsArticle[] {
  const parsed = parser.parse(xml);
  const items: RawItem[] = parsed?.rss?.channel?.item ?? [];

  const articles: NewsArticle[] = [];
  for (const item of items) {
    const link = asText(item.link);
    if (!link) continue;

    const rawDescription = asText(item.description);
    const publishedAt = Date.parse(asText(item.pubDate));

    articles.push({
      id: asText(item.guid) || link,
      title: asText(item.title),
      link,
      source: sourceName,
      publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
      summary: stripHtml(rawDescription),
      imageUrl: extractImageUrl(item, rawDescription),
    });
  }

  return articles;
}
