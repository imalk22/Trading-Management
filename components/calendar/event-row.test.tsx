import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventRow } from "./event-row";
import type { EconomicEvent } from "@/lib/calendar/types";

const baseEvent: EconomicEvent = {
  id: "USD-2026-09-09T14:00:00-04:00-FOMC Statement",
  title: "FOMC Statement",
  country: "USD",
  date: "2026-09-09T14:00:00-04:00",
  impact: "High",
  forecast: "",
  previous: "",
};

describe("EventRow", () => {
  it("renders the title and currency badge", () => {
    render(<EventRow event={baseEvent} />);
    expect(screen.getByText("FOMC Statement")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("renders a high-impact event's badge with the down-variant styling", () => {
    render(<EventRow event={baseEvent} />);
    const badge = screen.getByText("High");
    expect(badge.className).toContain("text-down");
  });

  it("renders a medium-impact event's badge with the neutral-variant styling", () => {
    render(<EventRow event={{ ...baseEvent, impact: "Medium" }} />);
    const badge = screen.getByText("Medium");
    expect(badge.className).toContain("text-muted-foreground");
  });

  it("renders forecast and previous values when present", () => {
    render(<EventRow event={{ ...baseEvent, forecast: "0.2%", previous: "0.3%" }} />);
    expect(screen.getByText(/Forecast: 0.2%/)).toBeInTheDocument();
    expect(screen.getByText(/Previous: 0.3%/)).toBeInTheDocument();
  });

  it("renders only forecast when previous is absent", () => {
    render(<EventRow event={{ ...baseEvent, forecast: "0.2%", previous: "" }} />);
    expect(screen.getByText(/Forecast: 0.2%/)).toBeInTheDocument();
    expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("renders only previous when forecast is absent", () => {
    render(<EventRow event={{ ...baseEvent, forecast: "", previous: "0.3%" }} />);
    expect(screen.getByText(/Previous: 0.3%/)).toBeInTheDocument();
    expect(screen.queryByText(/Forecast:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
