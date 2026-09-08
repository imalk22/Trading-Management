import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { EconomicEvent } from "@/lib/calendar/types";

const mockEvents: EconomicEvent[] = [
  {
    id: "USD-2026-09-09T14:00:00-04:00-FOMC Statement",
    title: "FOMC Statement",
    country: "USD",
    date: "2026-09-09T14:00:00-04:00",
    impact: "High",
    forecast: "",
    previous: "",
  },
  {
    id: "EUR-2026-09-09T05:00:00-04:00-Low Impact Release",
    title: "Low Impact Release",
    country: "EUR",
    date: "2026-09-09T05:00:00-04:00",
    impact: "Low",
    forecast: "",
    previous: "",
  },
];

const mockUseCalendar = vi.fn();

vi.mock("@/lib/query/use-calendar", () => ({
  useCalendar: () => mockUseCalendar(),
}));

import CalendarPage from "./page";

describe("CalendarPage", () => {
  beforeEach(() => {
    mockUseCalendar.mockReturnValue({ data: mockEvents, isLoading: false, isStale: false });
  });

  it("renders the Crypto Milestones card regardless of calendar data state", () => {
    render(<CalendarPage />);
    expect(screen.getByText("Crypto Milestones")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin Halving")).toBeInTheDocument();
  });

  it("defaults to showing only Medium+High impact events, hiding Low/Holiday", () => {
    render(<CalendarPage />);
    expect(screen.getByText("FOMC Statement")).toBeInTheDocument();
    expect(screen.queryByText("Low Impact Release")).not.toBeInTheDocument();
  });

  it("reveals Low/Holiday events when the impact filter is toggled", () => {
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: /show all impacts/i }));
    expect(screen.getByText("Low Impact Release")).toBeInTheDocument();
  });

  it("shows an unavailable message when there is no event data at all", () => {
    mockUseCalendar.mockReturnValue({ data: [], isLoading: false, isStale: false });
    render(<CalendarPage />);
    expect(screen.getByText(/calendar data is unavailable/i)).toBeInTheDocument();
  });

  it("shows a no-events-match message when the filter excludes everything", () => {
    mockUseCalendar.mockReturnValue({ data: [mockEvents[1]], isLoading: false, isStale: false });
    render(<CalendarPage />);
    expect(screen.getByText(/no events match/i)).toBeInTheDocument();
  });
});
