"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { requestMentor, respondMentorship, setMentor } from "@/actions/timetable";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/** Mentor switch (seniors from semester 3). */
export function MentorSwitch({ on, eligible }: { on: boolean; eligible: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string>();
  if (!eligible) {
    return (
      <p className="rounded-lg border border-line px-4 py-3 text-sm text-ink-2">
        From your third semester you can mentor juniors in your department.
      </p>
    );
  }
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="grid gap-0.5">
        <span className="font-semibold">Mentor juniors</span>
        <span className="text-[13px] text-ink-2">
          Juniors in your department can ask you for advice. You add the MENTOR stamp.
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={async (e) => {
          const next = e.target.checked;
          setValue(next);
          const r = await setMentor(next);
          if (!r.ok) {
            setValue(!next);
            setError(r.error);
          } else router.refresh();
        }}
        className="size-5 shrink-0 accent-[var(--brand)]"
      />
      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

type Mentor = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  batch_year: number | null;
  semester: number | null;
  bio: string | null;
  requested: boolean;
};

/** Phase 6 task 8: "Find a mentor" — seniors in your department who opted in. */
export function MentorList({ mentors }: { mentors: Mentor[] }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<Set<string>>(
    new Set(mentors.filter((m) => m.requested).map((m) => m.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!mentors.length) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
        No mentors in your department yet. Seniors can switch it on from this page.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {mentors.map((m) => {
        const name = m.full_name ?? m.handle ?? "Senior";
        return (
          <li key={m.id} className="grid gap-3 rounded-lg border border-line bg-surface p-3">
            <div className="flex items-center gap-3">
              <Link href={`/people/${m.handle}`}>
                <Avatar name={name} src={m.avatar_url} size="md" />
              </Link>
              <span className="grid min-w-0 flex-1">
                <Link
                  href={`/people/${m.handle}`}
                  className="truncate font-semibold hover:underline"
                >
                  {name}
                </Link>
                <span className="text-sm text-ink-2">
                  {m.batch_year && `Batch ${m.batch_year}`}
                  {m.semester && ` · Semester ${m.semester}`}
                </span>
              </span>
              {sent.has(m.id) ? (
                <span className="text-sm font-semibold text-ink-2">Asked</span>
              ) : (
                asking !== m.id && (
                  <Button size="sm" onClick={() => setAsking(m.id)}>
                    Ask to mentor
                  </Button>
                )
              )}
            </div>
            {m.bio && <p className="text-sm text-ink-2">{m.bio}</p>}
            {asking === m.id && (
              <div className="grid gap-2">
                <Textarea
                  aria-label="What would you like help with?"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Which teachers to pick for DSA?"
                />
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await requestMentor(m.id, note);
                      setBusy(false);
                      if (!r.ok) return setError(r.error);
                      setSent((s) => new Set(s).add(m.id));
                      setAsking(null);
                      setNote("");
                    }}
                  >
                    {busy && <Loader2 className="animate-spin" />} Send
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Request = {
  mentee_id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  batch_year: number | null;
  message: string | null;
};

/** Requests waiting for a mentor; accepting connects you. */
export function MentorRequests({ requests }: { requests: Request[] }) {
  const [done, setDone] = useState<Record<string, "accepted" | "declined">>({});
  const [error, setError] = useState<string>();
  if (!requests.length) return null;
  return (
    <section aria-labelledby="mentor-requests" className="grid gap-2">
      <h2 id="mentor-requests" className="text-lg font-bold">
        Asking you to mentor
      </h2>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {requests.map((r) => {
        const name = r.full_name ?? r.handle ?? "Student";
        return (
          <div
            key={r.mentee_id}
            className="grid gap-2 rounded-lg border border-brand/40 bg-surface p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={name} src={r.avatar_url} size="sm" />
              <span className="flex-1 font-semibold">{name}</span>
              {r.batch_year && <span className="text-sm text-ink-2">Batch {r.batch_year}</span>}
            </div>
            {r.message && <p className="text-sm">&ldquo;{r.message}&rdquo;</p>}
            {done[r.mentee_id] ? (
              <p className="text-sm font-semibold text-ink-2">
                {done[r.mentee_id] === "accepted" ? "You're connected now. Say hi!" : "Declined"}
              </p>
            ) : (
              <div className="flex gap-2">
                {([true, false] as const).map((accept) => (
                  <Button
                    key={String(accept)}
                    size="sm"
                    variant={accept ? "primary" : "secondary"}
                    className="flex-1"
                    onClick={async () => {
                      const res = await respondMentorship(r.mentee_id, accept);
                      if (!res.ok) return setError(res.error);
                      setDone((d) => ({ ...d, [r.mentee_id]: accept ? "accepted" : "declined" }));
                    }}
                  >
                    {accept ? <Check /> : <X />} {accept ? "Accept" : "Decline"}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
