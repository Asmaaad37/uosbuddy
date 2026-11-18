/**
 * Timetable PDF parser: a TypeScript port of timetable-parser by Ta1al
 * (https://github.com/Ta1al/timetable-parser), written with the project owner and used with
 * permission (docs/DECISIONS.md, 2026-11-17). The approach is theirs: day-header detection,
 * room bands down the left edge, cells that end at a time range, the lab-row threshold,
 * program-line resolution for truncated text, and semester inference.
 *
 * Our additions, for the department's Fall 2026 timetable (narrower cells, longer tables):
 * cells whose program, course, teacher or time wrap over several lines (parseWrapped), rows
 * that continue on the next page, and empty-room labels that sit close together. On the
 * original's sample PDFs the output is still identical (golden tests).
 *
 * This module is pure: it takes positioned words (see extract.server.ts) and returns the same
 * shape as the Python original, so the golden tests can compare the two directly.
 */

export type Word = { text: string; x0: number; x1: number; top: number; bottom: number };
export type PageWords = { width: number; height: number; words: Word[] };

export type ParsedSession = {
  combined_class: string | null;
  course_title: string | null;
  course_code: string | null;
  course_truncated: boolean;
  program_line: string | null;
  program_truncated: boolean;
  degree: string | null;
  program: string | null;
  program_code: string | null;
  section: string | null;
  session: string | null;
  semester: number | null;
  teacher_name: string | null;
  teacher_truncated: boolean;
  start_time: string | null;
  end_time: string | null;
  practical: boolean;
  raw_lines: string[];
};

export type RoomLabel = {
  page: number;
  region: number;
  room: string;
  top: number;
  /** Top of the label's first line. */
  first_top: number;
};
export type ParseWarning = { type: string; [key: string]: unknown };
export type ParseReport = {
  status: "clean" | "partial" | "failed";
  regions: { page: number; region: number; top: number; days: string[] }[];
  rooms: RoomLabel[];
  warnings: ParseWarning[];
  summary: { pages: number; regions: number; rooms: number; sessions: number; warnings: number };
};
/** Day name → room label → sessions, in the order they appear. */
export type Timetable = Record<string, Record<string, ParsedSession[]>>;

export const PARSER_VERSION = "ta1al-port-1";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_RE = /\((\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\)/;
const SESSION_RE = /\b(\d{4})\s*-\s*(\d{4})\b/;
const SEMESTER_RE = /Semester#\s*(\d+)/;
const DEGREE_RE = /^(BS|MS|PhD)\s+(?:in\s+)?/i;
const SECTION_RE = /(Regular|Self Support)\s*\d+/i;
const PROGRAM_CODES: Record<string, string> = {
  "computer science - specialization in artificial intelligence": "AI",
};
const PROGRAM_NAMES: Record<string, string> = {
  "computer science - specialization in artificial intelligence": "Artificial Intelligence",
};
const ROOM_RE = /\b(?:smart room|smart lab|committee room|online|room|hall|lab|cr|l)\b/i;
const ROW_GAP_THRESHOLD = 80;
// A course line ("Data Structures #CMPC-5205"); "Semester#1" is not one.
const COURSE_CODE_RE = /#\s*[A-Z]/;
const OPEN_TIME_RE = /\(\d{2}:\d{2}\s*-?\s*$/;
const CLOSE_TIME_RE = /^-?\s*\d{2}:\d{2}\s*\)/;
// The PDF's delete-button icon (a private-use glyph) shows up as its own line.
const DELETE_ICON = "";

type Line = { top: number; bottom: number; x0: number; x1: number; words: Word[] };
type Header = { top: number; days: [string, number][] };
type Candidate = {
  page: number;
  region: number;
  day: string;
  top: number;
  bottom: number;
  lines: string[];
  /** Set when the class continues a row from the previous page (see extractCandidates). */
  room?: string;
};

const mid = (w: Word) => (w.x0 + w.x1) / 2;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeSpacing(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ");
}

export function parseTimetable(
  pages: PageWords[],
  opts: { resolveTruncated?: boolean; keepTruncated?: boolean } = {},
): { timetable: Timetable; rooms: RoomLabel[]; report: ParseReport } {
  const resolveTruncated = opts.resolveTruncated ?? true;
  const keepTruncated = opts.keepTruncated ?? false;
  const { candidates, report } = extractCandidates(pages);
  const references = uniqueProgramLines(candidates.flatMap((c) => c.lines));
  const timetable: Timetable = {};

  for (const candidate of candidates) {
    const room = candidate.room ?? candidateRoom(candidate, report.rooms);
    if (!room) {
      report.warnings.push({
        type: "unassigned_session",
        page: candidate.page,
        region: candidate.region,
        day: candidate.day,
        top: round1(candidate.top),
        lines: candidate.lines,
      });
      continue;
    }
    const sessions = parseCell(
      candidate.lines.join("\n"),
      references,
      resolveTruncated,
      keepTruncated,
    );
    if (!sessions.length) {
      report.warnings.push({
        type: "malformed_session",
        page: candidate.page,
        region: candidate.region,
        day: candidate.day,
        room,
        top: round1(candidate.top),
        lines: candidate.lines,
      });
      continue;
    }
    ((timetable[candidate.day] ??= {})[room] ??= []).push(...sessions);
  }

  inferMissingSemesters(timetable);
  const sessionCount = Object.values(timetable).reduce(
    (n, rooms) => n + Object.values(rooms).reduce((m, s) => m + s.length, 0),
    0,
  );
  report.summary = {
    pages: pages.length,
    regions: report.regions.length,
    rooms: new Set(report.rooms.map((r) => r.room)).size,
    sessions: sessionCount,
    warnings: report.warnings.length,
  };
  report.status = !candidates.length ? "failed" : report.warnings.length ? "partial" : "clean";
  return { timetable, rooms: report.rooms, report };
}

function extractCandidates(pages: PageWords[]): { candidates: Candidate[]; report: ParseReport } {
  const report: ParseReport = {
    status: "failed",
    regions: [],
    rooms: [],
    warnings: [],
    summary: { pages: 0, regions: 0, rooms: 0, sessions: 0, warnings: 0 },
  };
  const candidates: Candidate[] = [];
  // A table row can run onto the next page (the Online row of a long timetable does). Carry
  // the last room of each page, and any class cut off at the bottom of a day column, over to
  // the top of the next page. This is our addition; the Python original drops those classes.
  let lastRoom: string | null = null;
  let carry = new Map<string, string[]>();
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const lines = makeLines(page.words);
    const headers = findDayHeaders(lines);
    const carried = carry;
    carry = new Map();
    headers.forEach((header, i) => {
      const region = i + 1;
      const nextTop = headers[i + 1]?.top ?? page.height;
      const bounds = dayBoundaries(header.days, page.width);
      report.regions.push({
        page: pageNumber,
        region,
        top: round1(header.top),
        days: header.days.map(([day]) => day),
      });
      const regionLines = lines.filter((l) => l.top > header.top + 1 && l.top < nextTop - 1);
      const rooms = findRooms(regionLines, bounds, pageNumber, region);
      report.rooms.push(...rooms);
      // The page's first table with no room label at all continues the previous page's row.
      const continues = i === 0 && !rooms.length && lastRoom !== null;
      if (!rooms.length && !continues) {
        report.warnings.push({ type: "missing_room_label", page: pageNumber, region });
      }
      const firstLabelTop = rooms.length ? Math.min(...rooms.map((r) => r.first_top)) : Infinity;
      const isLast = i === headers.length - 1;
      for (const [day, [left, right]] of Object.entries(bounds)) {
        const { result, pending } = makeCandidates(
          pageNumber,
          region,
          day,
          cropLines(regionLines, left, right),
        );
        if (i === 0 && lastRoom !== null) {
          const head = carried.get(day);
          const first = result[0];
          if (continues) {
            // No room label on this table: every class is still the previous page's row.
            for (const c of result) c.room = lastRoom;
            if (first && head) first.lines = [...head, ...first.lines];
          } else if (
            first &&
            head &&
            first.top < firstLabelTop &&
            !first.lines.some((l) => COURSE_CODE_RE.test(l))
          ) {
            // A class cut at the bottom of the last page: its tail is the first text here.
            first.room = lastRoom;
            first.lines = [...head, ...first.lines];
          }
        }
        candidates.push(...result);
        if (isLast && pending.length) carry.set(day, pending);
      }
      if (isLast) {
        const bottom = [...rooms].sort((a, b) => a.top - b.top).pop();
        if (bottom) lastRoom = bottom.room;
        else if (!continues) lastRoom = null;
      }
    });
    if (!headers.length) lastRoom = null;
  });
  return { candidates, report };
}

/** Groups positioned words into visual lines. */
function makeLines(words: Word[], tolerance = 1.5): Line[] {
  const groups: Word[][] = [];
  const sorted = [...words].sort((a, b) => a.top - b.top || a.x0 - b.x0);
  for (const word of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0]!.top - word.top) <= tolerance) last.push(word);
    else groups.push([word]);
  }
  return groups.map((group) => ({
    top: Math.min(...group.map((w) => w.top)),
    bottom: Math.max(...group.map((w) => w.bottom)),
    x0: Math.min(...group.map((w) => w.x0)),
    x1: Math.max(...group.map((w) => w.x1)),
    words: [...group].sort((a, b) => a.x0 - b.x0),
  }));
}

function findDayHeaders(lines: Line[]): Header[] {
  const headers: Header[] = [];
  for (const line of lines) {
    const days: [string, number][] = [];
    for (const word of line.words) {
      const day = normalizeDay(word.text);
      if (day) days.push([day, mid(word)]);
    }
    if (days.length >= 2) headers.push({ top: line.top, days });
  }
  // A header can span several nearby lines; keep the one with the most days in each band.
  const selected: Header[] = [];
  for (const header of headers) {
    const last = selected[selected.length - 1];
    if (last && header.top - last.top < 25) {
      if (header.days.length > last.days.length) selected[selected.length - 1] = header;
    } else selected.push(header);
  }
  return selected;
}

function dayBoundaries(
  input: [string, number][],
  pageWidth: number,
): Record<string, [number, number]> {
  const days = [...input].sort((a, b) => a[1] - b[1]);
  const result: Record<string, [number, number]> = {};
  // Headers have at least two days, so every day has a neighbour on one side.
  days.forEach(([day, center], i) => {
    const prev = days[i - 1]?.[1];
    const next = days[i + 1]?.[1];
    const left =
      prev === undefined ? Math.max(0, center - (next! - center) / 2) : (prev + center) / 2;
    const right =
      next === undefined ? Math.min(pageWidth, center + (center - prev!) / 2) : (center + next) / 2;
    result[day] = [left, right];
  });
  return result;
}

function cropLines(lines: Line[], left: number, right: number): [number, string][] {
  const result: [number, string][] = [];
  for (const line of lines) {
    const words = line.words.filter((w) => left <= mid(w) && mid(w) < right);
    if (words.length) result.push([line.top, words.map((w) => w.text).join(" ")]);
  }
  return result;
}

function makeCandidates(
  page: number,
  region: number,
  day: string,
  lines: [number, string][],
): { result: Candidate[]; pending: string[] } {
  const result: Candidate[] = [];
  let pending: string[] = [];
  let pendingBottom = 0;
  let top = 0;
  let previousTop: number | null = null;
  for (const [lineTop, raw] of lines) {
    const text = normalizeSpacing(raw);
    if (!text) continue;
    if (previousTop !== null && lineTop - previousTop > ROW_GAP_THRESHOLD) pending = [];
    if (!pending.length) top = lineTop;
    const last = pending[pending.length - 1];
    if (last !== undefined && OPEN_TIME_RE.test(last) && CLOSE_TIME_RE.test(text)) {
      // A time range that wraps ("(12:00 -" then "15:00)") is one line.
      pending[pending.length - 1] = `${last} ${text}`;
      pendingBottom = lineTop;
      previousTop = lineTop;
      if (TIME_RE.test(pending[pending.length - 1]!)) {
        result.push({ page, region, day, top, bottom: pendingBottom, lines: pending });
        pending = [];
        pendingBottom = 0;
        previousTop = null;
      }
      continue;
    }
    pending.push(text);
    pendingBottom = lineTop;
    previousTop = lineTop;
    if (TIME_RE.test(text)) {
      result.push({ page, region, day, top, bottom: pendingBottom, lines: pending });
      pending = [];
      pendingBottom = 0;
      previousTop = null;
    }
  }
  return { result, pending };
}

function findRooms(
  lines: Line[],
  bounds: Record<string, [number, number]>,
  page: number,
  region: number,
): RoomLabel[] {
  const firstDayLeft = Math.min(...Object.values(bounds).map(([left]) => left));
  const leftLines: [number, string][] = [];
  for (const line of lines) {
    const words = line.words.filter((w) => mid(w) < firstDayLeft);
    if (words.length) leftLines.push([line.top, words.map((w) => w.text).join(" ")]);
  }
  const blocks: [number, string][][] = [];
  for (const item of leftLines) {
    const last = blocks[blocks.length - 1];
    // Rows with no classes sit close together; split where one label ends and another starts.
    const joined = last && normalizeSpacing(last.map(([, v]) => v).join(" "));
    if (
      last &&
      item[0] - last[last.length - 1]![0] <= 14 &&
      !(endsRoom(joined!) && startsRoom(item[1]))
    ) {
      last.push(item);
    } else blocks.push([item]);
  }
  const rooms: RoomLabel[] = [];
  for (const block of blocks) {
    const text = normalizeSpacing(block.map(([, v]) => v).join(" "));
    if (looksLikeRoom(text)) {
      rooms.push({
        page,
        region,
        room: normalizeRoomLabel(text),
        top: block.reduce((n, [t]) => n + t, 0) / block.length,
        first_top: block[0]![0],
      });
    }
  }
  return rooms;
}

/** "OKM CR- 90", "JB-CR-No-17", "Jinnah Block Hall", "UMDC Room 1", "(Staff Room)". */
function endsRoom(value: string): boolean {
  return /(\b(?:CR|L)\s*-\s*\d+|\bNo-\d+|\b(?:Hall|Room|Office|Lab)(?:\s*\d+)?|\))$/.test(
    value.trim(),
  );
}

/**
 * A line that starts a new label rather than continuing one: not "Department of …",
 * "College of …", "(…", a lower-case word, a number or a dash.
 */
function startsRoom(value: string): boolean {
  return !/^(?:\(|Department of\b|College of\b|of\b|and\b|[a-z]|\d|-)/.test(value.trim());
}

function looksLikeRoom(value: string): boolean {
  const text = value.toLowerCase();
  if (/^room\s*\/\s*lab\b/.test(text)) return false;
  return ROOM_RE.test(text);
}

/** Restores labels whose words come out in column order rather than reading order. */
function normalizeRoomLabel(input: string): string {
  const value = normalizeSpacing(input);
  const match = /\bDepartment of [A-Za-z ]+?(?=\s+(?:CR-|L-|Lab|Room|Hall)|\s+\d+$|$)/.exec(value);
  if (!match || match.index === 0) return value;
  const prefix = value.slice(0, match.index).trim();
  const suffix = value.slice(match.index + match[0].length).trim();
  return normalizeSpacing(`${match[0]} ${prefix} ${suffix}`);
}

function candidateRoom(candidate: Candidate, rooms: RoomLabel[]): string | null {
  const matches = rooms
    .filter((r) => r.page === candidate.page && r.region === candidate.region)
    .sort((a, b) => a.top - b.top);
  if (!matches.length) return null;
  for (let i = 0; i < matches.length - 1; i++) {
    const item = matches[i]!;
    const next = matches[i + 1]!;
    if (
      (item.top <= candidate.bottom && candidate.bottom <= next.top) ||
      (item.top <= candidate.top && candidate.top <= next.top)
    ) {
      if (item.room.toLowerCase().includes("lab") && next.room.toLowerCase().includes("lab")) {
        const threshold = item.top + 0.4 * (next.top - item.top);
        if (candidate.bottom >= threshold || candidate.top >= threshold) return next.room;
      }
    }
  }
  const anchor = candidate.bottom || candidate.top;
  let best = matches[0]!;
  for (const item of matches) {
    const d = Math.abs(item.top - anchor);
    const bd = Math.abs(best.top - anchor);
    if (d < bd || (d === bd && item.top < best.top)) best = item;
  }
  return best.room;
}

function uniqueProgramLines(lines: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = normalizeSpacing(raw);
    if (looksLikeProgramLine(line) && !seen.has(line)) {
      seen.add(line);
      result.push(line);
    }
  }
  return result;
}

function parseCell(
  cell: string,
  references: string[],
  resolveTruncated: boolean,
  keepTruncated: boolean,
): ParsedSession[] {
  const lines = cell
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== DELETE_ICON && !l.toLowerCase().includes("delete"));
  const sessions: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    current.push(line);
    if (TIME_RE.test(line)) {
      sessions.push(current);
      current = [];
    }
  }
  return sessions.map((s) => parseSession(s, references, resolveTruncated, keepTruncated));
}

function parseSession(
  rawLines: string[],
  references: string[],
  resolveTruncated: boolean,
  keepTruncated: boolean,
): ParsedSession {
  const session = parseSessionLines(rawLines, references, resolveTruncated, keepTruncated);
  // Narrow cells wrap the program, course and teacher over several lines, and the Python
  // original then finds no program at all. Only in that case, read the cell as one text.
  if (session.program_line && session.teacher_name) return session;
  return parseWrapped(rawLines, session) ?? session;
}

function parseSessionLines(
  rawLines: string[],
  references: string[],
  resolveTruncated: boolean,
  keepTruncated: boolean,
): ParsedSession {
  let lines = rawLines.map((l) => l.trim()).filter(Boolean);
  let teacherIndex: number | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (TIME_RE.test(lines[i]!)) {
      teacherIndex = i;
      break;
    }
  }
  const teacherLine = teacherIndex !== null ? lines.splice(teacherIndex, 1)[0]! : null;
  const practical = lines.some((l) => l.toLowerCase().includes("practical"));
  lines = lines.filter((l) => l.toLowerCase() !== "practical");
  const combined = lines[0] !== undefined && isCombinedHeader(lines[0]) ? lines.shift()! : null;
  const programIndex = lines.findIndex((l) => looksLikeProgramLine(l));
  let programLine = programIndex >= 0 ? lines.splice(programIndex, 1)[0]! : null;
  const courseLine = lines.find((l) => l.includes("#")) ?? lines[0] ?? null;
  const [courseTitle, courseCode] = splitCourseLine(courseLine);
  const rawProgramLine = programLine;
  const programTruncated = hasEllipsis(rawProgramLine);
  if (resolveTruncated && rawProgramLine && programTruncated && !keepTruncated) {
    programLine = resolveProgramLine(rawProgramLine, references);
  }
  const [degree, parsedProgram, section, session, semester] = parseProgramFields(programLine);
  let program = parsedProgram;
  const programCode = getProgramCode(degree, program);
  if (programCode && program)
    program = PROGRAM_NAMES[normalizeSpacing(program).toLowerCase()] ?? program;
  const match = TIME_RE.exec(teacherLine ?? "");
  const teacherName = (teacherLine ?? "").split("(")[0]!.trim() || null;
  return {
    combined_class: combined,
    course_title: courseTitle,
    course_code: courseCode,
    course_truncated: hasEllipsis(courseTitle),
    program_line: programLine,
    program_truncated: programTruncated,
    degree,
    program,
    program_code: programCode,
    section,
    session,
    semester,
    teacher_name: teacherName,
    teacher_truncated: hasEllipsis(teacherName),
    start_time: match ? match[1]! : null,
    end_time: match ? match[2]! : null,
    practical,
    raw_lines: rawLines,
  };
}

// "BS in Computer Science Self Support 1 ( Fall 2026-2030 ) Semester#1", wherever it wraps.
const WRAPPED_PROGRAM_RE =
  /\b(?:BS|MS|PhD)\s+(?:in\s+)?.*?\(\s*(?:[A-Za-z]+\s+)?\d{4}\s*-\s*\d{4}\s*\)(?:\s*Semester#\s*\d+)?/;

/** Joins a cell's lines into one text: "#CMPC-" + "5201" and "2026-" + "2030" lose the space. */
function joinLines(lines: string[]): string {
  return lines.reduce(
    (text, line) =>
      !text ? line : /-$/.test(text) && /^\d/.test(line) ? text + line : `${text} ${line}`,
    "",
  );
}

/**
 * Reads a cell whose fields wrap over several lines (our addition; see parseSession).
 * Returns null when even the joined text has no program, so the line-by-line result stands.
 */
function parseWrapped(rawLines: string[], base: ParsedSession): ParsedSession | null {
  let lines = rawLines.map((l) => normalizeSpacing(l)).filter(Boolean);
  const practical = lines.some((l) => /\bpractical\b/i.test(l));
  lines = lines.map((l) => normalizeSpacing(l.replace(/\bpractical\b/gi, ""))).filter(Boolean);
  const combinedAt = lines.findIndex((l) => isCombinedHeader(l));
  const combined = combinedAt >= 0 ? lines.splice(combinedAt, 1)[0]! : null;
  const text = joinLines(lines);
  const program = WRAPPED_PROGRAM_RE.exec(text);
  const time = [...text.matchAll(new RegExp(TIME_RE.source, "g"))].pop();
  if (!program || !time) return null;
  const programLine = normalizeSpacing(program[0]);
  const [degree, parsedProgram, section, session, semester] = parseProgramFields(programLine);
  if (!degree) return null;
  let name = parsedProgram;
  const programCode = getProgramCode(degree, name);
  if (programCode && name) name = PROGRAM_NAMES[normalizeSpacing(name).toLowerCase()] ?? name;
  const [courseTitle, courseCode] = splitCourseLine(text.slice(0, program.index).trim() || null);
  const teacherName =
    normalizeSpacing(text.slice(program.index + program[0].length, time.index)) || null;
  return {
    ...base,
    combined_class: combined,
    course_title: courseTitle,
    course_code: courseCode ? courseCode.replace(/\s+/g, "") : null,
    course_truncated: hasEllipsis(courseTitle),
    program_line: programLine,
    program_truncated: hasEllipsis(programLine),
    degree,
    program: name,
    program_code: programCode,
    section,
    session,
    semester,
    teacher_name: teacherName,
    teacher_truncated: hasEllipsis(teacherName),
    start_time: time[1]!,
    end_time: time[2]!,
    practical,
  };
}

function splitCourseLine(value: string | null): [string | null, string | null] {
  if (!value) return [null, null];
  const at = value.lastIndexOf("#");
  if (at < 0) return [value.trim(), null];
  return [value.slice(0, at).trim() || null, value.slice(at + 1).trim() || null];
}

function hasEllipsis(value: string | null): boolean {
  return Boolean(value && (value.includes("…") || value.endsWith("...")));
}

function resolveProgramLine(programLine: string, references: string[]): string {
  const prefix = programLine.replaceAll("…", "").trim();
  const session = SESSION_RE.exec(programLine);
  const semester = SEMESTER_RE.exec(programLine);
  for (const candidate of references) {
    if (prefix && candidate.startsWith(prefix)) return candidate;
    if (session && candidate.includes(session[0]) && semester && candidate.includes(semester[1]!)) {
      return candidate;
    }
  }
  return programLine;
}

function parseProgramFields(
  value: string | null,
): [string | null, string | null, string | null, string | null, number | null] {
  if (!value) return [null, null, null, null, null];
  const cleaned = normalizeSpacing(value.replaceAll("(", " ( ").replaceAll(")", " ) "));
  const degreeMatch = DEGREE_RE.exec(cleaned);
  if (!degreeMatch) return [null, null, null, null, null];
  const degree = degreeMatch[1]!;
  const remainder = cleaned.slice(degreeMatch[0].length);
  const sectionMatch = SECTION_RE.exec(remainder);
  const program = sectionMatch ? remainder.slice(0, sectionMatch.index).trim() : null;
  const section = sectionMatch ? normalizeSpacing(sectionMatch[0]) : null;
  const sessionMatch = SESSION_RE.exec(cleaned);
  const semesterMatch = SEMESTER_RE.exec(cleaned);
  return [
    degree,
    program || null,
    section,
    sessionMatch ? sessionMatch[0].replaceAll(" ", "") : null,
    semesterMatch ? Number.parseInt(semesterMatch[1]!, 10) : null,
  ];
}

function looksLikeProgramLine(value: string): boolean {
  return DEGREE_RE.test(value.trim()) && SESSION_RE.test(value);
}

function getProgramCode(degree: string | null, program: string | null): string | null {
  return degree && program
    ? (PROGRAM_CODES[normalizeSpacing(program).toLowerCase()] ?? null)
    : null;
}

function isCombinedHeader(value: string): boolean {
  const v = value.toLowerCase();
  return v.startsWith("combined class") || /^combined\s*\(\d+\)/.test(v);
}

function normalizeDay(value: string): string | null {
  const v = value.trim().toLowerCase();
  return DAY_NAMES.find((day) => v.startsWith(day.toLowerCase())) ?? null;
}

function semesterKey(s: ParsedSession): string | null {
  const values = [s.degree, s.program, s.section, s.session];
  return values.every(Boolean)
    ? values.map((v) => normalizeSpacing(String(v))).join("\u0000")
    : null;
}

function inferMissingSemesters(timetable: Timetable): void {
  const known = new Map<string, Set<number>>();
  const all = Object.values(timetable).flatMap((rooms) => Object.values(rooms).flat());
  for (const s of all) {
    const key = semesterKey(s);
    if (key && s.semester !== null) {
      if (!known.has(key)) known.set(key, new Set());
      known.get(key)!.add(s.semester);
    }
  }
  for (const s of all) {
    const key = semesterKey(s);
    const set = key ? known.get(key) : undefined;
    if (key && s.semester === null && set && set.size === 1) s.semester = [...set][0]!;
  }
}
