/** One event as an iCalendar file (RFC 5545), for "Add to calendar" (Phase 8 task 3). */
export type IcsEvent = {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  url: string;
};

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

// Text values escape backslash, semicolon, comma and newlines.
const text = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 octets fold with CRLF + space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function toIcs(e: IcsEvent, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UOSBuddy//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@uosbuddy`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${text(e.title)}`,
    `DESCRIPTION:${text(e.description)}`,
    `LOCATION:${text(e.venue)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** All-day dates (the academic calendar) as one iCalendar file. End dates are inclusive. */
export type IcsDay = {
  id: string;
  title: string;
  description: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
};

const ymd = (iso: string) => iso.replaceAll("-", "");
const nextDay = (iso: string) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export function toIcsCalendar(name: string, days: IcsDay[], url: string, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UOSBuddy//Academic calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(name)}`,
    "X-WR-TIMEZONE:Asia/Karachi",
  ];
  for (const d of days) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@uosbuddy`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART;VALUE=DATE:${ymd(d.startsOn)}`,
      // DTEND is exclusive for all-day events: the day after the last day.
      `DTEND;VALUE=DATE:${ymd(nextDay(d.endsOn ?? d.startsOn))}`,
      `SUMMARY:${text(d.title)}`,
      `DESCRIPTION:${text(d.description)}`,
      `URL:${url}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
