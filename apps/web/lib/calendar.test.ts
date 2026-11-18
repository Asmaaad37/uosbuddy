import { describe, expect, it } from "vitest";
import {
  byMonth,
  dateRange,
  monthGrid,
  onDay,
  pakistanToday,
  upcoming,
  whenLabel,
} from "./calendar";
import { toIcsCalendar } from "./ics";

const ev = (id: string, starts_on: string, ends_on: string | null = null) => ({
  id,
  term: "2026-fall",
  kind: "deadline",
  title: id,
  notes: null,
  starts_on,
  ends_on,
  tentative: false,
});

describe("academic calendar", () => {
  it("formats single days and ranges", () => {
    expect(dateRange(ev("a", "2026-11-09"))).toBe("Mon 9 Nov");
    expect(dateRange(ev("a", "2026-11-02", "2026-11-06"))).toBe("Mon 2 Nov – Fri 6 Nov");
  });
  it("uses Pakistan's date, not the device's", () => {
    // 2026-11-18 20:00 UTC is already 19 November in Pakistan.
    expect(pakistanToday(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
  });
  it("says when", () => {
    expect(whenLabel(ev("a", "2026-11-18"), "2026-11-18")).toBe("Today");
    expect(whenLabel(ev("a", "2026-11-19"), "2026-11-18")).toBe("Tomorrow");
    expect(whenLabel(ev("a", "2026-11-25"), "2026-11-18")).toBe("In 7 days");
    expect(whenLabel(ev("a", "2026-11-16", "2026-11-20"), "2026-11-18")).toBe("Now");
  });
  it("lists the next dates, keeping ranges that are still on", () => {
    const list = [
      ev("past", "2026-11-01"),
      ev("mid", "2026-11-16", "2026-11-20"),
      ev("x", "2026-12-25"),
      ev("y", "2027-01-04"),
      ev("z", "2027-01-18"),
    ];
    expect(upcoming(list, "2026-11-18").map((e) => e.id)).toEqual(["mid", "x", "y"]);
  });
  it("groups by month and finds a day's dates", () => {
    expect(byMonth([ev("b", "2026-12-25"), ev("a", "2026-11-09")]).map(([m]) => m)).toEqual([
      "November 2026",
      "December 2026",
    ]);
    expect(onDay(ev("a", "2026-11-02", "2026-11-06"), "2026-11-04")).toBe(true);
    expect(onDay(ev("a", "2026-11-02", "2026-11-06"), "2026-11-07")).toBe(false);
  });
  it("lays a month out Monday first", () => {
    const weeks = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
  it("exports all-day dates with an exclusive end", () => {
    const ics = toIcsCalendar(
      "UoS 2026-27",
      [
        {
          id: "m",
          title: "Midterms",
          description: "",
          startsOn: "2026-11-02",
          endsOn: "2026-11-06",
        },
      ],
      "https://x/calendar",
      new Date("2026-11-18T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261102");
    expect(ics).toContain("DTEND;VALUE=DATE:20261107");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Karachi");
  });
});
