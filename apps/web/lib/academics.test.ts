import { describe, expect, it } from "vitest";
import { freeWindows, looksLikeCourseCode, minToTime, termLabel, timeToMin } from "./academics";

const slot = (day: number, start: string, end: string) => ({
  day,
  start_min: timeToMin(start)!,
  end_min: timeToMin(end)!,
});

describe("freeWindows", () => {
  it("is the whole day for an empty timetable", () => {
    expect(freeWindows([], 0)).toEqual([{ start: 480, end: 1020 }]);
  });

  it("merges overlapping and touching classes from different people", () => {
    const busy = [slot(0, "9:00", "10:30"), slot(0, "10:00", "11:00"), slot(0, "11:00", "12:00")];
    expect(freeWindows(busy, 0).map((w) => `${minToTime(w.start)}–${minToTime(w.end)}`)).toEqual([
      "8:00–9:00",
      "12:00–17:00",
    ]);
  });

  it("keeps gaps of exactly 30 minutes and drops shorter ones", () => {
    const busy = [slot(1, "8:00", "9:00"), slot(1, "9:30", "10:00"), slot(1, "10:29", "17:00")];
    expect(freeWindows(busy, 1)).toEqual([{ start: 540, end: 570 }]);
  });

  it("clips classes that run past the window and ignores other days", () => {
    const busy = [slot(2, "7:00", "8:30"), slot(2, "16:45", "18:00"), slot(3, "9:00", "17:00")];
    expect(freeWindows(busy, 2)).toEqual([{ start: 510, end: 1005 }]);
  });

  it("finds nothing on a fully booked day", () => {
    expect(freeWindows([slot(4, "8:00", "17:00")], 4)).toEqual([]);
  });
});

describe("times and terms", () => {
  it("parses and prints times", () => {
    expect(timeToMin("09:30")).toBe(570);
    expect(timeToMin("24:00")).toBeNull();
    expect(minToTime(780)).toBe("13:00");
  });

  it("names terms", () => {
    expect(termLabel("2026-fall")).toBe("Fall 2026");
    expect(termLabel("nope")).toBe("");
  });
});

describe("adding a course from a search", () => {
  it("tells a course code from a course name", () => {
    for (const code of ["CS-301", "cs 301", "BSCS3101", "MATH-101A"]) {
      expect(looksLikeCourseCode(code)).toBe(true);
    }
    for (const name of ["Object Oriented Programming", "Data Structures", "Calculus"]) {
      expect(looksLikeCourseCode(name)).toBe(false);
    }
  });
});
