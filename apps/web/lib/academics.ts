/** "2026-fall" → "Fall 2026". */
export function termLabel(term: string | null | undefined) {
  const m = /^(\d{4})-(fall|spring|summer)$/.exec(term ?? "");
  if (!m) return "";
  return `${m[2]![0]!.toUpperCase()}${m[2]!.slice(1)} ${m[1]}`;
}

export const RESOURCE_KINDS = {
  notes: "Notes",
  past_paper: "Past paper",
  outline: "Course outline",
  slides: "Slides",
  assignment: "Assignment",
} as const;
export type ResourceKind = keyof typeof RESOURCE_KINDS;

/** "1.2 MB" / "340 KB". */
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 570 → "9:30"; 780 → "13:00" (24-hour, as on UoS timetables). */
export function minToTime(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/** "9:30" / "09:30" → 570; null if it isn't a time. */
export function timeToMin(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export type Busy = { day: number; start_min: number; end_min: number };
export type Window = { start: number; end: number };

/**
 * Common free time on one day (§4.7): the window (08:00–17:00 by default) minus everyone's
 * busy slots, keeping gaps of at least `minLength` minutes. Slots may overlap or touch.
 */
export function freeWindows(
  busy: Busy[],
  day: number,
  {
    from = 8 * 60,
    to = 17 * 60,
    minLength = 30,
  }: { from?: number; to?: number; minLength?: number } = {},
): Window[] {
  const slots = busy
    .filter((s) => s.day === day && s.end_min > from && s.start_min < to)
    .map((s) => ({ start: Math.max(s.start_min, from), end: Math.min(s.end_min, to) }))
    .sort((a, b) => a.start - b.start);
  const out: Window[] = [];
  let cursor = from;
  for (const s of slots) {
    if (s.start - cursor >= minLength) out.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (to - cursor >= minLength) out.push({ start: cursor, end: to });
  return out;
}
