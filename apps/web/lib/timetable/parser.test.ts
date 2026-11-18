// @vitest-environment node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractWords } from "./extract";
import { parseTimetable, type ParsedSession } from "./parser";

// Golden tests: the port must give the same classes, rooms and times as the Python original
// (Ta1al/timetable-parser) on its sample PDFs. Expected files are that parser's output.
const fixture = (name: string) => fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));

type Expected = {
  summary: { pages: number; regions: number; rooms: number; sessions: number; warnings: number };
  rooms: string[];
  timetable: Record<string, Record<string, ParsedSession[]>>;
};

describe.each(["week2", "week3", "week4", "newweek1"])("timetable parser on %s.pdf", (name) => {
  it("matches the Python original", async () => {
    const expected = JSON.parse(
      await readFile(fixture(`${name}.expected.json`), "utf8"),
    ) as Expected;
    const pages = await extractWords(new Uint8Array(await readFile(fixture(`${name}.pdf`))));
    const { timetable, rooms, report } = parseTimetable(pages);

    expect(report.status).toBe("clean");
    expect(report.summary).toEqual(expected.summary);
    expect(rooms.map((r) => r.room)).toEqual(expected.rooms);
    expect(Object.keys(timetable)).toEqual(Object.keys(expected.timetable));
    for (const [day, rooms] of Object.entries(expected.timetable)) {
      expect(Object.keys(timetable[day] ?? {}), day).toEqual(Object.keys(rooms));
      for (const [room, sessions] of Object.entries(rooms)) {
        expect(timetable[day]?.[room], `${day} · ${room}`).toEqual(sessions);
      }
    }
  }, 60_000);
});

// The CS department's Fall 2026 timetable (shared by the project owner, 2026-11-18). Its narrow
// cells wrap the program, course, teacher and time over several lines, and the Online row
// runs over three pages. The Python original reads no program in it and drops the classes on
// the page without a room label; these are our additions. Counts are checked against the PDF:
// 350 class cards with a delete icon, plus 27 Online combined-class cards without one.
describe("timetable parser on cs-fall-2026.pdf", () => {
  it("reads every class, across wrapped cells and page breaks", async () => {
    const pages = await extractWords(new Uint8Array(await readFile(fixture("cs-fall-2026.pdf"))));
    const { timetable, report } = parseTimetable(pages);
    expect(report.status).toBe("clean");
    expect(report.summary.sessions).toBe(377);
    const all = Object.values(timetable).flatMap((rooms) => Object.values(rooms).flat());
    expect(all.filter((s) => !s.program_line || !s.teacher_name || !s.start_time)).toEqual([]);
    expect(timetable["Saturday"]?.["Online"]).toHaveLength(19);
    expect(timetable["Tuesday"]?.["Online"]).toHaveLength(8);

    // A class cut at the bottom of page 20 and finished on page 21.
    const quran = timetable["Saturday"]!["Online"]!.filter((s) =>
      s.combined_class?.includes("971"),
    );
    expect(quran.map((s) => [s.program, s.section, s.teacher_name, s.start_time])).toEqual([
      ["Computer Science", "Regular 1", "Bilal Ramzan", "08:00"],
      ["Artificial Intelligence", "Regular 1", "Bilal Ramzan", "08:00"],
    ]);

    // A wrapped cell: course, program and teacher each over two lines.
    const nlp = all.find((s) => s.course_code === "AIEC-7427");
    expect(nlp).toMatchObject({
      course_title: "Natural Language Processing",
      program: "Artificial Intelligence",
      degree: "MS",
      section: "Self Support 1",
      session: "2026-2029",
      semester: 2,
      teacher_name: "Dr. Hafiz Muhammad Faisal Shehzad",
      start_time: "14:00",
      end_time: "17:00",
    });

    // Rooms with no classes are their own rows, not one merged label.
    const labels = report.rooms.map((r) => r.room);
    expect(labels).toEqual(expect.arrayContaining(["OKM CR- 90", "JB-CR-No-17", "UMDC Room 3"]));
    expect(labels.some((l) => l.includes("OKM CR- 90 SSB"))).toBe(false);
  }, 60_000);
});
