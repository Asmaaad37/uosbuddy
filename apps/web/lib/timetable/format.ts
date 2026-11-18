/** Display helpers for official timetable data (admin review and, later, student views). */

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** 510 → "08:30". */
export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function importStatusLabel(status: string): string {
  return status === "review" ? "In review" : status === "published" ? "Published" : "Discarded";
}

const KINDS = [
  ["moved", "moved room", "moved room"],
  ["retimed", "new time", "new times"],
  ["teacher", "new teacher", "new teachers"],
  ["added", "added", "added"],
  ["removed", "removed", "removed"],
] as const;

/** {"moved": 5, "added": 2} → "5 moved room, 2 added". */
export function summaryLine(summary: unknown): string {
  const s = (summary && typeof summary === "object" ? summary : {}) as Record<string, number>;
  const parts = KINDS.filter(([k]) => s[k]).map(
    ([k, one, many]) => `${s[k]} ${s[k] === 1 ? one : many}`,
  );
  return parts.length ? parts.join(", ") : "no changes";
}

export type Slot = {
  course_title: string;
  course_code: string | null;
  room_label: string;
  teacher_name: string | null;
  day: number;
  start_min: number;
  end_min: number;
};

/** "Database Systems · Mon 08:00–09:30 · MAB CR-160 · Ayesha Kausar" */
export function slotLine(s: Slot): string {
  return [
    s.course_title,
    `${DAY_NAMES[s.day]?.slice(0, 3) ?? "?"} ${hhmm(s.start_min)}–${hhmm(s.end_min)}`,
    s.room_label,
    s.teacher_name,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What changed between two versions of a class, in a few words. */
export function changeLine(kind: string, before: Slot | null, after: Slot | null): string {
  if (kind === "added" && after) return slotLine(after);
  if (kind === "removed" && before) return slotLine(before);
  if (!before || !after) return "";
  const title = after.course_title;
  if (kind === "moved") return `${title}: ${before.room_label} → ${after.room_label}`;
  if (kind === "teacher") {
    return `${title}: ${before.teacher_name ?? "no teacher"} → ${after.teacher_name ?? "no teacher"}`;
  }
  const when = (s: Slot) =>
    `${DAY_NAMES[s.day]?.slice(0, 3) ?? "?"} ${hhmm(s.start_min)}–${hhmm(s.end_min)}`;
  return `${title}: ${when(before)} → ${when(after)}`;
}
