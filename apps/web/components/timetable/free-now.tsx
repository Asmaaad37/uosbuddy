"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Zap } from "lucide-react";
import { sendPing, setOnCampus, setShowFreeNow } from "@/actions/timetable";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { minToTime } from "@/lib/academics";
import { EmptyState } from "@/components/ui/empty-state";

type Person = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  free_until_min: number | null;
};

/** "You free?" — opens a 2-hour chat. Used on the free-now list and on profiles. */
export function PingButton({ target, label = "You free?" }: { target: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <span className="grid gap-1">
      <Button
        size="sm"
        variant="tinted"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await sendPing(target);
          setBusy(false);
          if (r.ok) router.push(`/chats/${r.data}`);
          else setError(r.error);
        }}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Zap />} {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

/** Phase 6 task 6: Who's free now — opt in, say you're on campus, ping someone. */
export function FreeNow({
  people,
  showMe,
  onCampusUntil,
}: {
  people: Person[];
  showMe: boolean;
  onCampusUntil: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(showMe);
  const [until, setUntil] = useState(
    onCampusUntil && new Date(onCampusUntil) > new Date() ? onCampusUntil : null,
  );
  const [error, setError] = useState<string>();

  async function toggleVisible(on: boolean) {
    setVisible(on);
    const r = await setShowFreeNow(on);
    if (!r.ok) {
      setVisible(!on);
      setError(r.error);
    }
  }

  async function toggleCampus(on: boolean) {
    const r = await setOnCampus(on ? 3 : 0);
    if (!r.ok) return setError(r.error);
    setUntil(r.data);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-card border border-sep bg-surface p-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="grid gap-0.5">
            <span className="font-semibold">Show me here</span>
            <span className="text-footnote text-sec">
              When you&apos;re on campus and not in class
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={visible}
            onChange={(e) => void toggleVisible(e.target.checked)}
            className="size-5 accent-[var(--accent)]"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="grid gap-0.5">
            <span className="font-semibold">I&apos;m on campus</span>
            <span className="text-footnote text-sec">
              {until
                ? `Until ${new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}`
                : "Turns itself off after 3 hours"}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!!until}
            onChange={(e) => void toggleCampus(e.target.checked)}
            className="size-5 accent-[var(--accent)]"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {people.length ? (
        <ul className="grid gap-2">
          {people.map((p) => {
            const name = p.full_name ?? p.handle ?? "Student";
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-card border border-sep bg-surface p-3"
              >
                <Avatar name={name} src={p.avatar_url} size="md" />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="text-sm text-sec">
                    {p.free_until_min !== null
                      ? `Free until ${minToTime(p.free_until_min)}`
                      : "Free for the day"}
                  </span>
                </span>
                <PingButton target={p.id} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Clock}>Nobody&apos;s free on campus right now.</EmptyState>
      )}
    </div>
  );
}
