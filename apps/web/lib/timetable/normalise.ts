import { z } from "zod";
import type { ParsedSession, Timetable } from "./parser";

/** A row for `stage_import` (see the 11.1 migration). */
export type StageRow = {
  program_id: string;
  intake_year: number;
  /** UoS admits in Fall and Spring; a "2024-2028" Fall and Spring batch are different classes. */
  intake_term: "fall" | "spring" | "summer" | null;
  section: "REG" | "SS1" | "SS2";
  course_code: string | null;
  course_title: string;
  teacher_name: string | null;
  building_code: string | null;
  room_code: string;
  room_label: string;
  day: number;
  start_min: number;
  end_min: number;
  practical: boolean;
  combined_key: string | null;
  raw: Record<string, unknown>;
};

export type Program = { id: string; name: string; level: string };
export type Skipped = { day: string; room: string; reason: string; lines: string[] };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEVELS: Record<string, string[]> = {
  bs: ["bs", "bs_5th_semester"],
  ms: ["ms_mphil"],
  phd: ["phd"],
};
const spaces = (v: string) => v.split(/\s+/).filter(Boolean).join(" ");

/**
 * "Regular N" (any N, including CS's "Regular 0") is Regular; Self Support 1 and 2 keep their
 * number. These are the profile codes. No shift is derived (DECISIONS, 2026-11-17).
 */
export function sectionCode(section: string | null): "REG" | "SS1" | "SS2" | null {
  const s = spaces(section ?? "").toLowerCase();
  if (/^regular\s*\d*$/.test(s)) return "REG";
  if (s === "self support 1") return "SS1";
  if (s === "self support 2") return "SS2";
  return null;
}

/** "2024-2028" → 2024. */
export function intakeYear(session: string | null): number | null {
  const m = /^(\d{4})\s*-\s*\d{4}$/.exec(session?.trim() ?? "");
  return m ? Number(m[1]) : null;
}

/** "BS in Computer Science Regular 1 ( Spring 2024-2028 ) Semester#6" → "spring". */
export function intakeTerm(programLine: string | null): "fall" | "spring" | "summer" | null {
  const m = /\(\s*(Fall|Spring|Summer)\s+\d{4}/i.exec(programLine ?? "");
  return m ? (m[1]!.toLowerCase() as "fall" | "spring" | "summer") : null;
}

/** "08:30" → 510. */
export function minutes(time: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const programKey = (name: string) =>
  spaces(
    name
      .toLowerCase()
      .replace(/^(bs|ms|mphil|phd)\b\.?\s*(in\s+)?/, "")
      .replace(/[^a-z0-9 ]/g, " "),
  );

/** Finds the catalogue program for a parsed degree ("BS") and program ("Computer Science"). */
export function matchProgram(degree: string | null, program: string | null, programs: Program[]) {
  const levels = LEVELS[(degree ?? "").toLowerCase()];
  if (!levels || !program) return null;
  const key = programKey(program);
  return programs.find((p) => levels.includes(p.level) && programKey(p.name) === key) ?? null;
}

const BUILDING = /^[A-Z]{2,4}$/;
const NOT_BUILDING = new Set(["CR", "L", "NO", "LAB"]);

/**
 * Splits a printed room label into building and room codes, and a short display label.
 * "Department of Computer Science MAB CR- 160" → MAB, CR-160, "MAB CR-160".
 * "JB-CR-No-17" → JB, CR-17. "Online" → no building, "Online".
 */
export function splitRoom(label: string): {
  building: string | null;
  code: string;
  display: string;
} {
  const original = spaces(label);
  let text = spaces(original.replace(/\([^)]*\)/g, " "));
  let building: string | null = null;
  const prefixed = /^([A-Z]{2,4})-(?=CR|L-|Hall)/.exec(text);
  if (prefixed) {
    building = prefixed[1]!;
    text = text.slice(prefixed[0].length);
  }
  let code: string | null = null;
  const room =
    /\b(CR|L)\s*-\s*(?:No-)?\s*(\d+)\b/i.exec(text) ??
    /\b(CR|L)-\s*[A-Za-z]+\s+(\d+)\b/i.exec(text);
  if (!building) {
    // The building is the code nearest before the room: "UMDC Al-Kindi Block IAH CR-181" is IAH.
    const isBuilding = (t: string) => BUILDING.test(t) && !NOT_BUILDING.has(t);
    const before = (room ? text.slice(0, room.index) : text).split(" ").filter(isBuilding);
    building = before.pop() ?? text.split(" ").find(isBuilding) ?? null;
  }
  if (room) {
    code = `${room[1]!.toUpperCase()}-${room[2]}`;
    // No building code, but a named hall or block: "Maryam Hall CR-1".
    const place =
      !building && /((?:[A-Z][a-z]+\s)?(?:Hall|Block))\s*$/.exec(text.slice(0, room.index));
    if (place) code = `${place[1]} ${code}`;
  }
  const hall = !code && /\bHall\s*-\s*(\d+)/i.exec(text);
  if (hall) code = `Hall-${hall[1]}`;
  if (!code) {
    // Named rooms: drop "Department of <name>", the building code and stray dashes.
    let rest = text;
    if (building) rest = rest.replace(new RegExp(`\\b${building}\\b`), "");
    rest = spaces(rest.replace(/(^|\s)-(\s|$)/g, " "));
    if (/^Department of /.test(rest)) {
      // "Department of Computer Science Smart Lab": the room is the trailing Lab/Room/Hall.
      const named = /((?:[A-Z][a-z]+\s)?(?:Lab|Room|Hall))$/.exec(rest);
      rest = named ? named[1]! : "";
    }
    code = rest || original;
  }
  code = code.slice(0, 40);
  return { building, code, display: building ? `${building} ${code}` : code };
}

/** "Combined Class (971)" → "971". */
function combinedKey(value: string | null) {
  if (!value) return null;
  return /\((\d+)\)/.exec(value)?.[1] ?? spaces(value).slice(0, 80);
}

/** "Understading of Holy Quran (1) URCG-5129" with code URCG-5129 → the title alone. */
function courseTitle(title: string, code: string | null) {
  const t = spaces(title);
  if (!code) return t;
  const key = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const words = t.split(" ");
  const last = words[words.length - 1] ?? "";
  return words.length > 1 && last.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === key
    ? words.slice(0, -1).join(" ")
    : t;
}

const teacher = (name: string | null) =>
  name && !/^to be allocated$/i.test(name.trim()) ? spaces(name).slice(0, 80) : null;

/** Parser output → rows to stage, plus every session that couldn't be placed and why. */
export function toStageRows(timetable: Timetable, programs: Program[]) {
  const rows: StageRow[] = [];
  const skipped: Skipped[] = [];
  for (const [dayName, rooms] of Object.entries(timetable)) {
    const day = DAYS.indexOf(dayName);
    for (const [roomLabel, sessions] of Object.entries(rooms)) {
      const room = splitRoom(roomLabel);
      for (const s of sessions) {
        const skip = (reason: string) =>
          skipped.push({ day: dayName, room: room.display, reason, lines: s.raw_lines });
        const start = minutes(s.start_time);
        const end = minutes(s.end_time);
        const program = matchProgram(s.degree, s.program, programs);
        const section = sectionCode(s.section);
        const intake = intakeYear(s.session);
        if (day < 0) skip(`Unknown day "${dayName}"`);
        else if (start === null || end === null || start >= end) skip("No valid class time");
        else if (!s.course_title) skip("No course title");
        else if (!program)
          skip(`Unknown program "${[s.degree, s.program].filter(Boolean).join(" ")}"`);
        else if (!section) skip(`Unknown section "${s.section ?? ""}"`);
        else if (!intake) skip(`No session years (like 2024-2028)`);
        else {
          rows.push({
            program_id: program.id,
            intake_year: intake,
            intake_term: intakeTerm(s.program_line),
            section,
            course_code: s.course_code ? spaces(s.course_code).slice(0, 20) : null,
            course_title: courseTitle(s.course_title, s.course_code).slice(0, 160),
            teacher_name: teacher(s.teacher_name),
            building_code: room.building,
            room_code: room.code,
            room_label: room.display.slice(0, 120),
            day,
            start_min: start,
            end_min: end,
            practical: s.practical,
            combined_key: combinedKey(s.combined_class),
            raw: { ...rawOf(s), room: roomLabel },
          });
        }
      }
    }
  }
  return { rows, skipped };
}

/** Every room the timetable lists, including rooms with no classes (for the free-room finder). */
export function roomsFromLabels(labels: string[]) {
  const seen = new Map<
    string,
    { building_code: string | null; room_code: string; room_label: string }
  >();
  for (const label of labels) {
    const r = splitRoom(label);
    const key = `${r.building ?? ""}|${r.code}`;
    if (!seen.has(key)) {
      seen.set(key, {
        building_code: r.building,
        room_code: r.code,
        room_label: r.display.slice(0, 120),
      });
    }
  }
  return [...seen.values()];
}

function rawOf(s: ParsedSession): Record<string, unknown> {
  return { ...s };
}

const text = z.string().max(400).nullable().default(null);
const sessionSchema = z.object({
  combined_class: text,
  course_title: text,
  course_code: text,
  course_truncated: z.boolean().default(false),
  program_line: text,
  program_truncated: z.boolean().default(false),
  degree: text,
  program: text,
  program_code: text,
  section: text,
  session: text,
  semester: z.number().int().nullable().default(null),
  teacher_name: text,
  teacher_truncated: z.boolean().default(false),
  start_time: text,
  end_time: text,
  practical: z.boolean().default(false),
  raw_lines: z.array(z.string().max(400)).max(40).default([]),
});

/**
 * The fallback path: JSON written by the Python parser (or this one). Accepts the parser's
 * output as is, including its "timestamp" and "rooms" keys, and keeps only the days.
 */
export function timetableFromJson(value: unknown): Timetable | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Timetable = {};
  for (const [key, rooms] of Object.entries(value)) {
    if (!DAYS.includes(key)) continue;
    if (!rooms || typeof rooms !== "object" || Array.isArray(rooms)) return null;
    for (const [room, sessions] of Object.entries(rooms)) {
      const parsed = z.array(sessionSchema).max(500).safeParse(sessions);
      if (!parsed.success || room.length > 200) return null;
      (out[key] ??= {})[room] = parsed.data satisfies ParsedSession[];
    }
  }
  return Object.keys(out).length ? out : null;
}
