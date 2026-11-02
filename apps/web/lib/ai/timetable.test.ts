import { describe, expect, it } from "vitest";
import { readTime, toDrafts } from "./timetable";

describe("timetable from a screenshot", () => {
  it("reads common time formats, assuming afternoon for 1–7 o'clock", () => {
    expect(readTime("8:30")).toBe(510);
    expect(readTime("08:30")).toBe(510);
    expect(readTime("1:30")).toBe(810);
    expect(readTime("1:30 PM")).toBe(810);
    expect(readTime("12:00 PM")).toBe(720);
    expect(readTime("13.30")).toBe(810);
    expect(readTime("noon")).toBeNull();
  });

  it("links course codes, drops unreadable rows and duplicates, sorts by day and time", () => {
    const courses = [{ id: "c1", code: "CS-301", title: "Data Structures" }];
    const drafts = toDrafts(
      {
        classes: [
          {
            day: "Tuesday",
            start: "11:00",
            end: "12:30",
            course_code: null,
            course_title: "Calculus",
            room: " Room 4 ",
          },
          {
            day: "Monday",
            start: "2:00",
            end: "3:30",
            course_code: "cs 301",
            course_title: null,
            room: null,
          },
          {
            day: "Monday",
            start: "2:00",
            end: "3:30",
            course_code: "CS301",
            course_title: null,
            room: null,
          },
          {
            day: "Someday",
            start: "9:00",
            end: "10:00",
            course_code: null,
            course_title: "X",
            room: null,
          },
          {
            day: "Wed",
            start: "10:00",
            end: "9:00",
            course_code: null,
            course_title: "Y",
            room: null,
          },
        ],
      },
      courses,
    );
    expect(drafts).toEqual([
      { day: 0, start: 840, end: 930, label: "Data Structures", room: null, course: "c1" },
      { day: 1, start: 660, end: 750, label: "Calculus", room: "Room 4", course: null },
    ]);
  });
});
