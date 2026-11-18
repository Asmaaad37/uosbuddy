import { describe, expect, it } from "vitest";
import { duration, nowNext, pakistanNow, toWeekItems, type WeekItem } from "./week";

const item = (day: number, start: number, end: number, title = "Class"): WeekItem => ({
  key: `${day}-${start}`,
  title,
  room: "MAB CR-160",
  teacher: null,
  day,
  start_min: start,
  end_min: end,
  own: false,
});

describe("Pakistan time", () => {
  it("uses Asia/Karachi whatever the device's zone", () => {
    // 2026-11-18 03:30 UTC is Wednesday 08:30 in Pakistan (UTC+5).
    expect(pakistanNow(new Date("2026-11-18T03:30:00Z"))).toEqual({ day: 2, min: 510 });
    // 2026-11-22 20:00 UTC is Monday 01:00 in Pakistan.
    expect(pakistanNow(new Date("2026-11-22T20:00:00Z"))).toEqual({ day: 0, min: 60 });
  });
});

describe("now and next", () => {
  const week = [item(0, 480, 570, "Databases"), item(0, 600, 690, "Networks"), item(1, 480, 570)];

  it("names the class that's on now", () => {
    expect(nowNext(week, { day: 0, min: 500 })).toMatchObject({
      state: "now",
      item: { title: "Databases" },
      minutesLeft: 70,
    });
  });
  it("names the next class today, between classes", () => {
    expect(nowNext(week, { day: 0, min: 575 })).toMatchObject({
      state: "next",
      item: { title: "Networks" },
      minutesUntil: 25,
    });
  });
  it("ends at the class's end minute (back-to-back classes)", () => {
    const backToBack = [item(0, 480, 570, "A"), item(0, 570, 660, "B")];
    expect(nowNext(backToBack, { day: 0, min: 570 })).toMatchObject({
      state: "now",
      item: { title: "B" },
    });
  });
  it("is done after the last class, and none on a free day", () => {
    expect(nowNext(week, { day: 0, min: 700 })).toEqual({ state: "done" });
    expect(nowNext(week, { day: 4, min: 500 })).toEqual({ state: "none" });
  });
});

describe("week items", () => {
  it("merges official and own classes in time order", () => {
    const items = toWeekItems(
      [
        {
          id: "o1",
          course_title: "Databases",
          course_code: "CMPC-5203",
          room_label: "MAB CR-160",
          room_id: null,
          teacher_name: "Iqra Waheed",
          day: 0,
          start_min: 600,
          end_min: 690,
          practical: false,
          group_label: null,
          follow_id: null,
        },
      ],
      [{ id: "p1", day: 0, start_min: 480, end_min: 540, label: "Library", room: null }],
    );
    expect(items.map((i) => [i.title, i.own])).toEqual([
      ["Library", true],
      ["Databases", false],
    ]);
  });
  it("formats durations", () => {
    expect(duration(25)).toBe("25 min");
    expect(duration(60)).toBe("1 h");
    expect(duration(90)).toBe("1 h 30 min");
  });
});
