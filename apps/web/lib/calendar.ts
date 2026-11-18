/** Phase 11.4: the academic calendar for students. Dates are calendar days in Pakistan. */

export type CalendarEvent = {
  id: string;
  term: string | null;
  kind: string;
  title: string;
  notes: string | null;
  starts_on: string; // YYYY-MM-DD
  ends_on: string | null;
  tentative: boolean;
};

export const KIND_LABEL: Record<string, string> = {
  term: "Classes",
  registration: "Registration",
  add_drop: "Enrol or change",
  withdraw: "Withdraw",
  midterm: "Midterms",
  final: "Finals",
  result: "Results",
  holiday: "Holiday",
  break: "Break",
  deadline: "Deadline",
  other: "Other",
};

/** Kinds that can't be missed; "Remind me of every deadline" covers these. */
export const DEADLINE_KINDS = new Set([
  "registration",
  "add_drop",
  "withdraw",
  "midterm",
  "final",
  "result",
  "deadline",
]);

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(date(iso));

/** Today in Pakistan, as YYYY-MM-DD. */
export function pakistanToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}

/** "Mon 2 Nov" or "Mon 2 Nov – Fri 6 Nov". */
export function dateRange(e: Pick<CalendarEvent, "starts_on" | "ends_on">): string {
  const one = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
  return e.ends_on && e.ends_on !== e.starts_on
    ? `${one(e.starts_on)} – ${one(e.ends_on)}`
    : one(e.starts_on);
}

/** Whole days from today to the date (0 = today). */
export function daysUntil(iso: string, today: string): number {
  return Math.round((date(iso).getTime() - date(today).getTime()) / 86_400_000);
}

/** "Today", "Tomorrow", "In 5 days", "Now" (for a range that has started). */
export function whenLabel(e: Pick<CalendarEvent, "starts_on" | "ends_on">, today: string): string {
  const d = daysUntil(e.starts_on, today);
  if (d < 0) return e.ends_on && daysUntil(e.ends_on, today) >= 0 ? "Now" : "Past";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

/** The next `n` dates that haven't ended, soonest first. */
export function upcoming(events: CalendarEvent[], today: string, n = 3): CalendarEvent[] {
  return events
    .filter((e) => (e.ends_on ?? e.starts_on) >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .slice(0, n);
}

/** Groups dates by the month they start in: [["November 2026", [...]], ...]. */
export function byMonth(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => a.starts_on.localeCompare(b.starts_on))) {
    const key = fmt(e.starts_on, { month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()];
}

/** Whether a date falls on `day` (YYYY-MM-DD), counting ranges. */
export function onDay(e: Pick<CalendarEvent, "starts_on" | "ends_on">, day: string): boolean {
  return e.starts_on <= day && day <= (e.ends_on ?? e.starts_on);
}

/** The weeks (Monday first) of a month, as YYYY-MM-DD or null for padding. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10));
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
