import { describe, expect, it } from "vitest";
import { clockTime, dayLabel, sameDay, shortTime, startsGroup } from "./chat";

// Pakistan time is UTC+5: 10:00 UTC on Sat 31 Oct 2026 is 15:00 in Sargodha.
const pk = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  new Date(Date.UTC(y, mo, d, h - 5, mi));
const now = pk(2026, 9, 31, 15, 0);

describe("shortTime", () => {
  it("shows Pakistan time today, the weekday this week, the date before", () => {
    expect(shortTime(pk(2026, 9, 31, 9, 5), now)).toBe("09:05");
    expect(shortTime(pk(2026, 9, 27, 20, 0), now)).toBe("Tue");
    expect(shortTime(pk(2026, 9, 12, 8, 0), now)).toBe("12 Oct");
    expect(shortTime(pk(2025, 11, 30), now)).toBe("30 Dec 2025");
  });

  it("uses the Pakistan day, not the UTC one", () => {
    // 00:30 PKT on the 31st is still the 30th in UTC.
    expect(shortTime(pk(2026, 9, 31, 0, 30), now)).toBe("00:30");
    expect(clockTime(pk(2026, 9, 31, 0, 30))).toBe("00:30");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel(pk(2026, 9, 31, 1), now)).toBe("Today");
    expect(dayLabel(pk(2026, 9, 30, 23), now)).toBe("Yesterday");
    expect(dayLabel(pk(2026, 9, 27), now)).toBe("Tue 27 Oct");
    expect(sameDay(pk(2026, 9, 31, 0, 1), pk(2026, 9, 31, 23, 59))).toBe(true);
  });
});

describe("startsGroup", () => {
  const at = (min: number) => pk(2026, 9, 31, 15, min).toISOString();
  it("groups the same sender within 5 minutes", () => {
    expect(startsGroup(undefined, { sender_id: "a", created_at: at(0) })).toBe(true);
    expect(
      startsGroup({ sender_id: "a", created_at: at(0) }, { sender_id: "a", created_at: at(4) }),
    ).toBe(false);
    expect(
      startsGroup({ sender_id: "a", created_at: at(0) }, { sender_id: "b", created_at: at(1) }),
    ).toBe(true);
    expect(
      startsGroup({ sender_id: "a", created_at: at(0) }, { sender_id: "a", created_at: at(6) }),
    ).toBe(true);
  });
});
