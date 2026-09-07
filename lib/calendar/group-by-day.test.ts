import { describe, it, expect } from "vitest";
import { groupEventsByLocalDay } from "./group-by-day";
import type { EconomicEvent } from "./types";

function makeEvent(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "test-id",
    title: "Test Event",
    country: "USD",
    date: "2026-09-08T09:00:00-04:00",
    impact: "Medium",
    forecast: "",
    previous: "",
    ...overrides,
  };
}

describe("groupEventsByLocalDay", () => {
  it("groups an event under the viewer's local calendar day, which can differ from the feed's own timezone", () => {
    // 2026-09-07T21:30:00-04:00 is Sept 7 in the feed's own zone (US Eastern),
    // but crosses midnight into Sept 8 for a viewer in Asia/Colombo (UTC+5:30).
    const event = makeEvent({ id: "a", date: "2026-09-07T21:30:00-04:00" });

    const groupsInColombo = groupEventsByLocalDay([event], "Asia/Colombo");
    expect(groupsInColombo).toEqual([{ dateKey: "2026-09-08", events: [event] }]);

    const groupsInNewYork = groupEventsByLocalDay([event], "America/New_York");
    expect(groupsInNewYork).toEqual([{ dateKey: "2026-09-07", events: [event] }]);
  });

  it("sorts groups chronologically and sorts events within each group chronologically", () => {
    const laterOnDay1 = makeEvent({ id: "later-day1", date: "2026-09-07T20:00:00-04:00" });
    const earlierOnDay1 = makeEvent({ id: "earlier-day1", date: "2026-09-07T08:00:00-04:00" });
    const onDay2 = makeEvent({ id: "day2", date: "2026-09-08T08:00:00-04:00" });

    // Passed in scrambled order on purpose.
    const groups = groupEventsByLocalDay([onDay2, laterOnDay1, earlierOnDay1], "America/New_York");

    expect(groups).toEqual([
      { dateKey: "2026-09-07", events: [earlierOnDay1, laterOnDay1] },
      { dateKey: "2026-09-08", events: [onDay2] },
    ]);
  });

  it("returns an empty array for no events", () => {
    expect(groupEventsByLocalDay([], "America/New_York")).toEqual([]);
  });

  it("defaults to the runtime's local timezone when no timeZone argument is given", () => {
    const event = makeEvent({ id: "a", date: "2026-09-08T09:00:00-04:00" });
    const groups = groupEventsByLocalDay([event]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toEqual([event]);
  });

  it("skips events with an unparseable date instead of throwing, keeping the valid events grouped", () => {
    const valid1 = makeEvent({ id: "valid-1", date: "2026-09-07T08:00:00-04:00" });
    const invalid = makeEvent({ id: "invalid", date: "not-a-real-date" });
    const valid2 = makeEvent({ id: "valid-2", date: "2026-09-08T08:00:00-04:00" });

    expect(() => groupEventsByLocalDay([valid1, invalid, valid2], "America/New_York")).not.toThrow();

    const groups = groupEventsByLocalDay([valid1, invalid, valid2], "America/New_York");
    expect(groups).toEqual([
      { dateKey: "2026-09-07", events: [valid1] },
      { dateKey: "2026-09-08", events: [valid2] },
    ]);
  });

  it("preserves original relative order for events sharing the exact same timestamp", () => {
    const sameInstant = "2026-09-07T12:00:00-04:00";
    const first = makeEvent({ id: "first", country: "USD", date: sameInstant });
    const second = makeEvent({ id: "second", country: "EUR", date: sameInstant });
    const third = makeEvent({ id: "third", country: "GBP", date: sameInstant });

    const groups = groupEventsByLocalDay([first, second, third], "America/New_York");

    expect(groups).toEqual([{ dateKey: "2026-09-07", events: [first, second, third] }]);
  });
});
