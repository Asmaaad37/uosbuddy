/** Backup request labels shared by the screens (Phase 5 task 4). */
export const CATEGORIES = ["notes", "help", "ride", "company", "item", "other"] as const;

export const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  notes: { label: "Notes", emoji: "📒" },
  help: { label: "Help", emoji: "🙋" },
  ride: { label: "Ride", emoji: "🛵" },
  company: { label: "Company", emoji: "🤝" },
  item: { label: "Borrow", emoji: "🧰" },
  other: { label: "Other", emoji: "✨" },
};

export const URGENCY_LABELS: Record<number, string> = {
  1: "Whenever",
  2: "Today",
  3: "Urgent",
};

/** "3h left", "45m left", "Ended". */
export function timeLeft(expiresAt: string, now: Date = new Date()) {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h left` : `${Math.round(hours / 24)}d left`;
}

export const STATUS_LABELS: Record<string, string> = {
  open: "Waiting for help",
  claimed: "Someone's on it",
  resolved: "Done",
  expired: "Expired",
  cancelled: "Cancelled",
};
