import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EconomicEvent } from "@/lib/calendar/types";

export interface EventRowProps {
  event: EconomicEvent;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatLocalTime(dateStr: string): string {
  return timeFormatter.format(new Date(dateStr));
}

export function EventRow({ event }: EventRowProps) {
  const impactVariant = event.impact === "High" ? "down" : "neutral";

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">{formatLocalTime(event.date)}</span>
          <Badge variant="neutral">{event.country}</Badge>
          <span className="text-sm font-medium">{event.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {(event.forecast || event.previous) && (
            <span className="text-xs text-muted-foreground">
              {event.forecast && `Forecast: ${event.forecast}`}
              {event.forecast && event.previous && " · "}
              {event.previous && `Previous: ${event.previous}`}
            </span>
          )}
          <Badge variant={impactVariant}>{event.impact}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
