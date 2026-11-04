"use client";

import { useState } from "react";
import { saveNotificationPrefs, type NotificationPrefs } from "@/actions/notifications";
import { PushPrompt } from "@/components/notifications/push-prompt";

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: "connections",
    label: "Connect requests",
    hint: "Someone wants to connect, or accepted you",
  },
  { key: "backup", label: "Backup pings", hint: "Classmates nearby need backup (5 a day at most)" },
  { key: "comments", label: "Comments and replies", hint: "On your posts and comments" },
  { key: "messages", label: "Chat messages", hint: "As pushes; muted chats never ping" },
  {
    key: "digest",
    label: "Weekly email",
    hint: "A short Sunday summary of what's new for you",
  },
  {
    key: "push",
    label: "Push notifications",
    hint: "Off: everything stays in the app, on all your devices",
  },
];

/** Settings → Notifications: per-type switches, saved as you flip them. */
export function PrefsForm({ initial }: { initial: NotificationPrefs }) {
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

  return (
    <div className="grid gap-4">
      <PushPrompt reason="Turn on notifications for this device." />
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {ROWS.map((r) => (
          <li key={r.key}>
            <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
              <span className="grid gap-0.5">
                <span className="font-semibold">{r.label}</span>
                <span className="text-[13px] text-ink-2">{r.hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[r.key]}
                onChange={(e) => void flip(r.key, e.target.checked)}
                className="size-5 shrink-0 accent-[var(--brand)]"
              />
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
