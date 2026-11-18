"use client";

import { useState } from "react";
import { saveNotificationPrefs, type NotificationPrefs } from "@/actions/notifications";
import { PushDevice } from "@/components/notifications/push-device";
import { GroupedList } from "@/components/ui/grouped-list";
import { Switch } from "@/components/ui/switch";

type PrefRow = { key: keyof NotificationPrefs; label: string; hint: string };

const ALERTS: PrefRow[] = [
  {
    key: "connections",
    label: "Connect requests",
    hint: "Someone wants to connect, or accepted you",
  },
  { key: "backup", label: "Backup pings", hint: "Classmates nearby need backup (5 a day at most)" },
  { key: "comments", label: "Comments and replies", hint: "On your posts and comments" },
  { key: "messages", label: "Chat messages", hint: "As pushes; muted chats never ping" },
  {
    key: "timetable",
    label: "Timetable and calendar",
    hint: "When your class moves room, time or teacher, and reminders you set for calendar dates",
  },
];

const DELIVERY: PrefRow[] = [
  {
    key: "push",
    label: "Push notifications",
    hint: "Alerts on your phones and computers. When off, you only see them inside the app.",
  },
  {
    key: "previews",
    label: "Show message text",
    hint: "In alerts on your lock screen. When off, they just say who it's from.",
  },
  {
    key: "digest",
    label: "Weekly email",
    hint: "A short Sunday summary of what's new for you",
  },
];

/** Settings → Notifications: per-type switches, saved as you flip them. */
export function PrefsForm({
  initial,
  endpoints,
}: {
  initial: NotificationPrefs;
  endpoints: string[];
}) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string>();

  async function flip(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const result = await saveNotificationPrefs(next);
    if (!result.ok) {
      setPrefs(prefs);
      setError(result.error);
    } else setError(undefined);
  }

  const row = (r: PrefRow) => (
    <li key={r.key}>
      <label className="flex w-full cursor-pointer items-center gap-4 pl-4 transition-colors active:bg-raised">
        <span
          data-row-text
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 shadow-[inset_0_-1px_0_var(--sep)]"
        >
          <span className="grid min-w-0 flex-1">
            <span className="text-body text-label">{r.label}</span>
            <span className="text-footnote text-ter">{r.hint}</span>
          </span>
          <Switch checked={prefs[r.key]} onChange={(e) => void flip(r.key, e.target.checked)} />
        </span>
      </label>
    </li>
  );

  return (
    <div className="grid gap-6">
      <PushDevice endpoints={endpoints} />
      <GroupedList header="What alerts you">{ALERTS.map(row)}</GroupedList>
      <GroupedList header="How you hear about it">{DELIVERY.map(row)}</GroupedList>
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
