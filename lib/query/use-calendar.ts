import { useStaleAwareQuery, type StaleAwareResult } from "./use-stale-query";
import type { EconomicEvent } from "@/lib/calendar/types";

async function fetchCalendarEvents(): Promise<EconomicEvent[]> {
  const res = await fetch("/api/calendar");
  if (!res.ok) throw new Error(`Failed to fetch calendar events: ${res.status}`);
  const body = await res.json();
  return body.events;
}

export function useCalendar(): StaleAwareResult<EconomicEvent[]> {
  return useStaleAwareQuery({
    queryKey: ["calendar"],
    queryFn: fetchCalendarEvents,
    refetchInterval: 5 * 60_000,
  });
}
