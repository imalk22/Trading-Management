"use client";

import { useState } from "react";
import { useCalendar } from "@/lib/query/use-calendar";
import { groupEventsByLocalDay } from "@/lib/calendar/group-by-day";
import { CRYPTO_MILESTONES } from "@/lib/calendar/crypto-milestones";
import { EventRow } from "@/components/calendar/event-row";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaleBadge } from "@/components/markets/stale-badge";
import type { EventImpact } from "@/lib/calendar/types";

const LOW_IMPACT: EventImpact[] = ["Low", "Holiday"];

function formatDayHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function CalendarPage() {
  const { data: events, isLoading, isStale } = useCalendar();
  const [showAllImpacts, setShowAllImpacts] = useState(false);

  const visibleEvents = (events ?? []).filter((event) =>
    showAllImpacts ? true : !LOW_IMPACT.includes(event.impact)
  );
  const dayGroups = groupEventsByLocalDay(visibleEvents);

  return (
    <main className="flex flex-col gap-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          {isStale && <StaleBadge />}
        </div>
        <p className="text-sm text-muted-foreground">This week&apos;s macro-economic events that move markets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crypto Milestones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {CRYPTO_MILESTONES.map((milestone) => (
            <div key={milestone.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{milestone.title}</span>
                {milestone.isEstimate && <Badge variant="neutral">Estimated</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{milestone.description}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Economic Events</h2>
        <Button
          variant={showAllImpacts ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAllImpacts((v) => !v)}
        >
          {showAllImpacts ? "Showing all" : "Show all impacts"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (events?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">Economic calendar data is unavailable right now.</p>
      ) : dayGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events match the current filter.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {dayGroups.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{formatDayHeading(group.dateKey)}</h3>
              <div className="flex flex-col gap-2">
                {group.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
