import { NextResponse } from "next/server";
import type { EconomicEvent, EventImpact } from "@/lib/calendar/types";

const CALENDAR_FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const VALID_IMPACTS: EventImpact[] = ["Low", "Medium", "High", "Holiday"];

let cache: { events: EconomicEvent[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

interface RawEvent {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeEvent(raw: RawEvent): EconomicEvent | null {
  const title = asText(raw.title);
  const country = asText(raw.country);
  const date = asText(raw.date);
  const impact = asText(raw.impact);

  if (!title || !date || Number.isNaN(Date.parse(date))) return null;
  if (!VALID_IMPACTS.includes(impact as EventImpact)) return null;

  return {
    id: `${country}-${date}-${title}`,
    title,
    country,
    date,
    impact: impact as EventImpact,
    forecast: asText(raw.forecast),
    previous: asText(raw.previous),
  };
}

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ events: cache.events });
  }

  let events: EconomicEvent[] = [];
  try {
    const res = await fetch(CALENDAR_FEED_URL);
    if (!res.ok) throw new Error(`Failed to fetch calendar feed: ${res.status}`);
    const raw: RawEvent[] = await res.json();
    events = raw.map(normalizeEvent).filter((e): e is EconomicEvent => e !== null);
  } catch (err) {
    console.error("[calendar] failed to fetch/parse calendar feed:", err);
  }

  if (events.length > 0) {
    cache = { events, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return NextResponse.json({ events });
}
