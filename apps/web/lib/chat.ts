// Chat times are shown in Pakistan time (UTC+5, no daylight saving) whether the page is
// rendered on a UTC server or in the browser, so they match and never flip at 5 am.
const PKT_OFFSET = 5 * 60 * 60_000;
const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Wall-clock fields in Pakistan time. */
function pkt(value: string | Date) {
  const d = new Date(new Date(value).getTime() + PKT_OFFSET);
  return {
    day: Math.floor(d.getTime() / DAY),
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hh: String(d.getUTCHours()).padStart(2, "0"),
    mm: String(d.getUTCMinutes()).padStart(2, "0"),
  };
}

/** "14:05" for bubbles. */
export function clockTime(value: string | Date) {
  const t = pkt(value);
  return `${t.hh}:${t.mm}`;
}

/** Chat list times: "14:05" today, "Mon" this week, "12 Oct" before that. */
export function shortTime(value: string | Date, now: Date = new Date()) {
  const t = pkt(value);
  const today = pkt(now).day;
  if (t.day === today) return `${t.hh}:${t.mm}`;
  if (today - t.day <= 6 && t.day < today) return WEEKDAYS[t.weekday]!;
  const base = `${t.date} ${MONTHS[t.month]}`;
  return t.year === pkt(now).year ? base : `${base} ${t.year}`;
}

/** "Today", "Yesterday" or "Tue 27 Oct" for the day dividers in a conversation. */
export function dayLabel(value: string | Date, now: Date = new Date()) {
  const t = pkt(value);
  const diff = pkt(now).day - t.day;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const base = `${WEEKDAYS[t.weekday]} ${t.date} ${MONTHS[t.month]}`;
  return t.year === pkt(now).year ? base : `${base} ${t.year}`;
}

/** Whether two times fall on the same Pakistan-time day. */
export function sameDay(a: string | Date, b: string | Date) {
  return pkt(a).day === pkt(b).day;
}

/** Whether `next` starts a new run of bubbles (another sender, or 5+ minutes later). */
export function startsGroup(
  prev: { sender_id: string | null; created_at: string } | undefined,
  next: { sender_id: string | null; created_at: string },
) {
  if (!prev || prev.sender_id !== next.sender_id) return true;
  return new Date(next.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;
}
