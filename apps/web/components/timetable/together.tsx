"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { freeTogether, type DayWindows } from "@/actions/timetable";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { minToTime } from "@/lib/academics";
import { cn } from "@/lib/utils";

type Person = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Phase 6 task 6: pick connections, see when you're all free (08:00–17:00, 30 min+). */
export function FreeTogether({ connections }: { connections: Person[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<DayWindows[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function find() {
    setBusy(true);
    setError(undefined);
    const r = await freeTogether(picked);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r.data);
  }

  if (!connections.length) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
        Connect with classmates to find time you&apos;re all free.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="flex flex-wrap gap-2" aria-label="Pick people">
        {connections.map((c) => {
          const name = c.full_name ?? c.handle ?? "Student";
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => {
                  setResult(null);
                  setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id].slice(0, 10)));
                }}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-pill border py-1 pr-3 pl-1 text-sm font-semibold",
                  on ? "border-brand bg-brand/10" : "border-line bg-surface",
                )}
              >
                <Avatar name={name} src={c.avatar_url} size="sm" className="size-8" />
                {name.split(" ")[0]}
                {on && <Check className="size-4 text-brand" />}
              </button>
            </li>
          );
        })}
      </ul>
      <Button onClick={find} disabled={busy || picked.length === 0}>
        {busy && <Loader2 className="animate-spin" />} Find free time
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {result && (
        <section aria-label="Free together" className="grid gap-2">
          {result.map((d) => (
            <div
              key={d.day}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3"
            >
              <span className="w-10 shrink-0 font-bold">{d.day}</span>
              {d.windows.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {d.windows.map((w) => (
                    <li
                      key={w.start}
                      className="rounded-pill bg-lane-learn/20 px-2.5 py-1 text-sm font-semibold tabular-nums"
                    >
                      {minToTime(w.start)}–{minToTime(w.end)}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-ink-2">No common free time</span>
              )}
            </div>
          ))}
          <p className="text-xs text-ink-2">
            Between 8:00 and 17:00, gaps of 30 minutes or more. Friends who keep their free time
            private count as free.
          </p>
        </section>
      )}
    </div>
  );
}
