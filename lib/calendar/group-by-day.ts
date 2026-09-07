import type { EconomicEvent } from "./types";

export interface DayGroup {
  dateKey: string;
  events: EconomicEvent[];
}

export function groupEventsByLocalDay(events: EconomicEvent[], timeZone?: string): DayGroup[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const groups = new Map<string, EconomicEvent[]>();
  for (const event of sorted) {
    const parsed = new Date(event.date);
    if (Number.isNaN(parsed.getTime())) continue;

    const key = formatter.format(parsed);
    const existing = groups.get(key);
    if (existing) existing.push(event);
    else groups.set(key, [event]);
  }

  return Array.from(groups.entries()).map(([dateKey, events]) => ({ dateKey, events }));
}
