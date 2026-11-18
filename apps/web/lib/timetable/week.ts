/** Phase 11.2: the student's week, and what's on now or next (Pakistan time). */

export type OfficialClass = {
  id: string;
  course_title: string;
  course_code: string | null;
  room_label: string;
  room_id: string | null;
  teacher_name: string | null;
  day: number;
  start_min: number;
  end_min: number;
  practical: boolean;
  /** Set for a class followed from another section. */
  group_label: string | null;
  follow_id: string | null;
};

export type MyTimetable = {
  group: { id: string; label: string } | null;
  matched: "choice" | "profile" | null;
  term: string;
  week_of: string | null;
  published_at: string | null;
  classes: OfficialClass[];
};

/** A class on the student's week, official or added by them. */
export type WeekItem = {
  key: string;
  title: string;
  room: string | null;
  teacher: string | null;
  day: number;
  start_min: number;
  end_min: number;
  own: boolean;
};

const DAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Day (0 = Monday) and minute of the day in Pakistan, whatever the device's time zone. */
export function pakistanNow(date = new Date()): { day: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: DAY_INDEX[get("weekday")] ?? 0,
    min: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function toWeekItems(
  classes: OfficialClass[],
  own: {
    id: string;
    day: number;
    start_min: number;
    end_min: number;
    label: string;
    room: string | null;
  }[],
): WeekItem[] {
  return [
    ...classes.map((c) => ({
      key: c.id,
      title: c.course_title,
      room: c.room_label,
      teacher: c.teacher_name,
      day: c.day,
      start_min: c.start_min,
      end_min: c.end_min,
      own: false,
    })),
    ...own.map((s) => ({
      key: s.id,
      title: s.label,
      room: s.room,
      teacher: null,
      day: s.day,
      start_min: s.start_min,
      end_min: s.end_min,
      own: true,
    })),
  ].sort((a, b) => a.day - b.day || a.start_min - b.start_min);
}

export type NowNext =
  | { state: "now"; item: WeekItem; minutesLeft: number }
  | { state: "next"; item: WeekItem; minutesUntil: number }
  | { state: "done" }
  | { state: "none" };

/**
 * What's on now, or next today. "done" when today's classes are over; "none" when there are
 * no classes today (the card hides itself rather than showing a gap).
 */
export function nowNext(items: WeekItem[], now: { day: number; min: number }): NowNext {
  const today = items.filter((i) => i.day === now.day).sort((a, b) => a.start_min - b.start_min);
  if (!today.length) return { state: "none" };
  const current = today.find((i) => i.start_min <= now.min && now.min < i.end_min);
  if (current) return { state: "now", item: current, minutesLeft: current.end_min - now.min };
  const next = today.find((i) => i.start_min > now.min);
  if (next) return { state: "next", item: next, minutesUntil: next.start_min - now.min };
  return { state: "done" };
}

/** 25 → "25 min"; 90 → "1 h 30 min"; 60 → "1 h". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
