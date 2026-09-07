import type { EconomicEvent } from "./types";

export interface DayGroup {
  dateKey: string;
  events: EconomicEvent[];
}

function localDateKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function groupEventsByLocalDay(events: EconomicEvent[], timeZone?: string): DayGroup[] {
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const groups = new Map<string, EconomicEvent[]>();
  for (const event of sorted) {
    const key = localDateKey(new Date(event.date), timeZone);
    const existing = groups.get(key);
    if (existing) existing.push(event);
    else groups.set(key, [event]);
  }

  return Array.from(groups.entries()).map(([dateKey, events]) => ({ dateKey, events }));
}
