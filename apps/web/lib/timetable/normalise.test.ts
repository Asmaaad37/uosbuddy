// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractWords } from "./extract";
import {
  intakeTerm,
  intakeYear,
  matchProgram,
  minutes,
  sectionCode,
  splitRoom,
  timetableFromJson,
  roomsFromLabels,
  toStageRows,
} from "./normalise";
import { parseTimetable } from "./parser";

// The CS department's programs, as in the catalogue seed.
const CS = [
  { id: "bscs", name: "BS in Computer Science", level: "bs" },
  { id: "mscs", name: "MS Computer Science", level: "ms_mphil" },
  { id: "phdcs", name: "PhD Computer Science", level: "phd" },
  { id: "bsai", name: "BS in Artificial Intelligence", level: "bs" },
  { id: "bsds", name: "BS in Data Science", level: "bs" },
  { id: "msai", name: "MS Artificial Intelligence", level: "ms_mphil" },
];

describe("sections", () => {
  it("maps any Regular N, including CS's Regular 0, to REG", () => {
    expect(sectionCode("Regular 0")).toBe("REG");
    expect(sectionCode("Regular 1")).toBe("REG");
    expect(sectionCode("regular  2")).toBe("REG");
  });
  it("keeps Self Support 1 and 2", () => {
    expect(sectionCode("Self Support 1")).toBe("SS1");
    expect(sectionCode("Self Support 2")).toBe("SS2");
  });
  it("flags anything else", () => {
    expect(sectionCode("Evening")).toBeNull();
    expect(sectionCode(null)).toBeNull();
  });
});

describe("intake, times and programs", () => {
  it("reads the intake year from the session", () => {
    expect(intakeYear("2024-2028")).toBe(2024);
    expect(intakeYear("Fall 2024")).toBeNull();
  });
  it("reads the intake season, so Fall and Spring batches stay apart", () => {
    expect(intakeTerm("BS in Computer Science Regular 1 ( Fall 2024-2028 ) Semester#5")).toBe(
      "fall",
    );
    expect(intakeTerm("BS in Computer Science Regular 1 ( Spring 2024-2028 ) Semester#6")).toBe(
      "spring",
    );
    expect(intakeTerm("BS in Artificial Intelligence Regular 1 ( 2026-2030 )")).toBeNull();
  });
  it("turns times into minutes", () => {
    expect(minutes("08:30")).toBe(510);
    expect(minutes("13:00")).toBe(780);
    expect(minutes("25:00")).toBeNull();
  });
  it("matches degree and program to the catalogue", () => {
    expect(matchProgram("BS", "Computer Science", CS)?.id).toBe("bscs");
    expect(matchProgram("BS", "Artificial Intelligence", CS)?.id).toBe("bsai");
    expect(matchProgram("MS", "Artificial Intelligence", CS)?.id).toBe("msai");
    expect(matchProgram("PhD", "Computer Science", CS)?.id).toBe("phdcs");
    expect(matchProgram("BS", "Software Engineering", CS)).toBeNull();
    expect(matchProgram("MS", "Data Science", CS)).toBeNull();
  });
});

describe("rooms", () => {
  it.each([
    ["Department of Computer Science MAB CR- 160", "MAB", "CR-160"],
    ["Department of Computer Science MAB CR-160", "MAB", "CR-160"],
    ["Department of Computer Science MAB L-04 (Computer Lab)", "MAB", "L-04"],
    ["Department of IAH Physics CR- 181", "IAH", "CR-181"],
    ["Department of Physics IAH CR- 181", "IAH", "CR-181"],
    ["Department of IAH L- Physics 04 (Computer Practical Lab)", "IAH", "L-04"],
    ["IAH L-04 Department of Physics (Computer Practical Lab)", "IAH", "L-04"],
    ["Department of Social Work IKM - CR-52", "IKM", "CR-52"],
    ["JB-CR-No-17", "JB", "CR-17"],
    ["SSB CR-106", "SSB", "CR-106"],
    ["NAB Hall- 1 First Floor", "NAB", "Hall-1"],
    ["Department of Computer Science Smart Lab", null, "Smart Lab"],
    ["Department of Computer Science MAB - Committee Room", "MAB", "Committee Room"],
    ["Online", null, "Online"],
    ["Jinnah Block Hall", null, "Jinnah Block Hall"],
    ["UMDC Al-Kindi Block IAH CR- 181", "IAH", "CR-181"],
    ["Department of International Relations IKM CR-50", "IKM", "CR-50"],
    ["Department of Computer Science MAB L- 02", "MAB", "L-02"],
    ["Department of Information Technology Maryam Hall CR- 1", null, "Maryam Hall CR-1"],
    ["IKM -CR-52", "IKM", "CR-52"],
    ["OKM CR- 90", "OKM", "CR-90"],
    ["UMDC Room 1", "UMDC", "Room 1"],
  ])("%s → %s %s", (label, building, code) => {
    const room = splitRoom(label);
    expect(room.building).toBe(building);
    expect(room.code).toBe(code);
    expect(room.display).toBe(building ? `${building} ${code}` : code);
  });
});

describe("parser output to stage rows", () => {
  it.each(["week2", "week3", "week4", "newweek1"])("places every CS class in %s", (name) => {
    const path = fileURLToPath(new URL(`./__fixtures__/${name}.expected.json`, import.meta.url));
    const expected = JSON.parse(readFileSync(path, "utf8")) as {
      summary: { sessions: number };
      timetable: unknown;
    };
    const timetable = timetableFromJson(expected.timetable);
    expect(timetable).not.toBeNull();
    const { rows, skipped } = toStageRows(timetable!, CS);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(expected.summary.sessions);
    for (const row of rows) {
      expect(row.start_min).toBeLessThan(row.end_min);
      expect(["REG", "SS1", "SS2"]).toContain(row.section);
      expect(row.room_label).not.toMatch(/Department of/);
    }
  });

  it("places every class of the Fall 2026 timetable, Fall and Spring batches apart", async () => {
    const file = fileURLToPath(new URL("./__fixtures__/cs-fall-2026.pdf", import.meta.url));
    const { timetable } = parseTimetable(await extractWords(new Uint8Array(readFileSync(file))));
    const { rows, skipped } = toStageRows(timetable, CS);
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(377);
    const bscs2024 = new Set(
      rows
        .filter((r) => r.program_id === "bscs" && r.intake_year === 2024 && r.section === "REG")
        .map((r) => `${r.intake_term} ${(r.raw as { semester: number }).semester}`),
    );
    expect([...bscs2024].sort()).toEqual(["fall 5", "spring 6"]);
    expect(rows.find((r) => r.course_code === "URCG-5129")?.course_title).toBe(
      "Understading of Holy Quran (1)",
    );
    expect(new Set(rows.map((r) => r.room_label))).toContain("IAH CR-181");
  }, 60_000);

  it("explains rows it can't place", () => {
    const { rows, skipped } = toStageRows(
      {
        Monday: {
          "SSB CR-106": [
            {
              combined_class: null,
              course_title: "Calculus",
              course_code: "MATH-1101",
              course_truncated: false,
              program_line: null,
              program_truncated: false,
              degree: "BS",
              program: "Software Engineering",
              program_code: null,
              section: "Regular 1",
              session: "2025-2029",
              semester: 3,
              teacher_name: "To be allocated",
              teacher_truncated: false,
              start_time: "08:00",
              end_time: "09:30",
              practical: false,
              raw_lines: ["Calculus #MATH-1101"],
            },
          ],
        },
      },
      CS,
    );
    expect(rows).toEqual([]);
    expect(skipped[0]?.reason).toBe('Unknown program "BS Software Engineering"');
  });

  it("lists every room once, including rooms with no classes", () => {
    expect(
      roomsFromLabels(["OKM CR- 90", "Department of Computer Science MAB CR- 160", "MAB CR-160"]),
    ).toEqual([
      { building_code: "OKM", room_code: "CR-90", room_label: "OKM CR-90" },
      { building_code: "MAB", room_code: "CR-160", room_label: "MAB CR-160" },
    ]);
  });

  it("rejects JSON that isn't parser output", () => {
    expect(timetableFromJson([])).toBeNull();
    expect(timetableFromJson({ Monday: [] })).toBeNull();
    expect(timetableFromJson({ timestamp: "x" })).toBeNull();
  });
});
