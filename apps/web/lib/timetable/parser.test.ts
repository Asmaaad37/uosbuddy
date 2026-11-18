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
