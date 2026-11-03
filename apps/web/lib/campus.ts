/**
 * Phase 8: campus life constants. The ride areas are a first draft for the project owner
 * to correct; students can also type an area that isn't listed.
 */
export const RIDE_AREAS: { group: string; areas: string[] }[] = [
  { group: "Campus", areas: ["UoS main gate", "UoS back gate", "UoS hostels"] },
  {
    group: "Sargodha",
    areas: [
      "University Road",
      "Satellite Town",
      "Sargodha Cantt",
      "Club Road",
      "Kachehri Bazar",
      "Muslim Town",
      "Lahore Road",
      "Faisalabad Road",
      "Jhal Chakian",
      "Railway Station",
      "General Bus Stand",
      "Daewoo Terminal",
    ],
  },
  {
    group: "Nearby and home districts",
    areas: [
      "Bhalwal",
      "Kot Momin",
      "Sillanwali",
      "Shahpur",
      "Sahiwal (Sargodha)",
      "Bhera",
      "Lalian",
      "Khushab",
      "Jauharabad",
      "Mianwali",
      "Jhang",
      "Chiniot",
      "Faisalabad",
      "Mandi Bahauddin",
      "Gujrat",
      "Lahore",
      "Islamabad / Rawalpindi",
    ],
  },
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "Mon–Fri", "Mon, Wed, Fri" or "" for a one-off ride. */
export function recurringLabel(days: number[] | null | undefined) {
  const d = [...new Set(days ?? [])].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  if (!d.length) return "";
  if (d.length === 7) return "Every day";
  const run = d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  if (run && d.length >= 3) return `${WEEKDAYS[d[0]!]}–${WEEKDAYS[d.at(-1)!]}`;
  return d.map((x) => WEEKDAYS[x]).join(", ");
}

export const LISTING_KINDS = {
  sell: { label: "For sale", tab: "Sell", done: "Mark sold", doneLabel: "Sold", emoji: "🏷️" },
  buy: { label: "Wanted", tab: "Buy", done: "Mark found", doneLabel: "Found", emoji: "🔎" },
  free: { label: "Free", tab: "Free", done: "Mark given", doneLabel: "Given away", emoji: "🎁" },
  lost: { label: "Lost", tab: "Lost", done: "Mark found", doneLabel: "Found", emoji: "❓" },
  found: {
    label: "Found",
    tab: "Found",
    done: "Mark returned",
    doneLabel: "Returned",
    emoji: "📦",
  },
} as const;
export type ListingKind = keyof typeof LISTING_KINDS;
export const LISTING_KIND_KEYS = Object.keys(LISTING_KINDS) as ListingKind[];

/** 2500 → "Rs 2,500"; 0 → "Free". */
export function pkr(amount: number | null | undefined) {
  if (amount == null) return null;
  if (amount === 0) return "Free";
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

/** Times in Pakistan, as students read them: "Fri 7 Nov, 4:30 pm". */
export function pkTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** A <input type="datetime-local"> value (Pakistan time) as an ISO instant. */
export function fromPkLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Now (plus some minutes) as a datetime-local value in Pakistan time. */
export function pkLocalIn(minutes: number, now = new Date()) {
  const t = new Date(now.getTime() + minutes * 60_000 + 5 * 3_600_000);
  return t.toISOString().slice(0, 16);
}

export const RIDE_SAFETY_TIPS = [
  "Meet at a busy, well-known place: a campus gate, not someone's home.",
  "Share the ride details with a friend or family member before you leave.",
  "Agree on the fare split in the ride chat before the trip.",
  "Never share your CNIC or bank details. UOSBuddy never shows phone numbers.",
  "Report anyone who makes you uncomfortable. It's anonymous.",
];
