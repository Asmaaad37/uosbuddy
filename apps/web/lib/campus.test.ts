import { describe, expect, it } from "vitest";
import { fromPkLocal, pkLocalIn, pkr, recurringLabel } from "./campus";
import { toIcs } from "./ics";

describe("campus life helpers", () => {
  it("describes recurring ride days", () => {
    expect(recurringLabel([])).toBe("");
    expect(recurringLabel([0, 1, 2, 3, 4])).toBe("Mon–Fri");
    expect(recurringLabel([4, 0, 2])).toBe("Mon, Wed, Fri");
    expect(recurringLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
  });

  it("formats rupees", () => {
    expect(pkr(2500)).toBe("Rs 2,500");
    expect(pkr(0)).toBe("Free");
    expect(pkr(null)).toBeNull();
  });

  it("reads datetime-local values as Pakistan time", () => {
    expect(fromPkLocal("2026-11-07T16:30")).toBe("2026-11-07T11:30:00.000Z");
    expect(fromPkLocal("tomorrow")).toBeNull();
    expect(pkLocalIn(60, new Date("2026-11-07T11:30:00Z"))).toBe("2026-11-07T17:30");
  });
});

describe("calendar export", () => {
  const ics = toIcs(
    {
      id: "e1",
      title: "Open debate; all welcome, bring friends",
      description: "Line one\nLine two",
      venue: "Hall A",
      startsAt: "2026-11-07T11:30:00Z",
      endsAt: "2026-11-07T13:00:00Z",
      url: "https://uosbuddy.example/events/e1",
    },
    new Date("2026-11-01T00:00:00Z"),
  );

  it("writes a valid event with escaped text and a 1-hour alarm", () => {
    expect(ics).toContain("DTSTART:20261107T113000Z\r\n");
    expect(ics).toContain("SUMMARY:Open debate\\; all welcome\\, bring friends\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines at 75 octets", () => {
    const long = toIcs({
      id: "e2",
      title: "x".repeat(200),
      description: "",
      venue: "v",
      startsAt: "2026-11-07T11:30:00Z",
      endsAt: "2026-11-07T13:00:00Z",
      url: "u",
    });
    for (const line of long.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
