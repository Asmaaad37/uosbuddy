"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Check, ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { DocViewer } from "@/components/admin/doc-viewer";
import { decideVerification } from "@/actions/admin";
import { FLAG_LABELS, type Precheck } from "@/lib/ai/precheck";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";
import { describeStudentId } from "@/lib/student-id";
import { cn } from "@/lib/utils";

export type QueueItem = {
  id: string;
  updatedAt: string;
  docPath: string | null;
  docUrl: string | null;
  submittedName: string | null;
  accountName: string | null;
  studentId: string | null;
  email: string | null;
  emailIsUni: boolean;
  whatsapp: string | null;
  precheck: Precheck | null;
};

type Picker = "rejected" | "needs_info";

const TEMPLATES: Record<Picker, string[]> = {
  needs_info: [
    "The photo is blurry or cut off. Please upload a clearer one.",
    "We can't see your roll number on it. Please upload a document that shows it.",
    "The name or roll number doesn't match what you typed. Please check and resubmit.",
  ],
  rejected: [
    "This isn't a University of Sargodha document.",
    "The document doesn't show your name and roll number.",
    "The document appears to belong to someone else.",
  ],
};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
};

/** Admin verification queue (Phase 1 task 7). Keys: A approve, R reject, N needs info, J/K move. */
export function ReviewQueue({
  items,
  waitingOnStudents,
}: {
  items: QueueItem[];
  waitingOnStudents: number;
}) {
  const router = useRouter();
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const queue = useMemo(() => items.filter((i) => !decided.has(i.id)), [items, decided]);
  const [index, setIndex] = useState(0);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const current = queue[Math.min(index, queue.length - 1)];
  const parts = current?.studentId ? describeStudentId(current.studentId) : null;
  const namesDiffer =
    !!current?.accountName &&
    !!current.submittedName &&
    current.accountName.trim().toLowerCase() !== current.submittedName.trim().toLowerCase();

  const move = useCallback(
    (step: number) => {
      setPicker(null);
      setIndex((i) => Math.max(0, Math.min(queue.length - 1, i + step)));
    },
    [queue.length],
  );

  const decide = useCallback(
    async (decision: "verified" | Picker, why?: string) => {
      if (!current || busy) return;
      setBusy(true);
      const result = await decideVerification({ requestId: current.id, decision, reason: why });
      setBusy(false);
      if (!result.ok) return toast.error(result.error);

      const name = current.submittedName ?? "Student";
      toast.success(
        decision === "verified"
          ? `${name} is verified`
          : decision === "rejected"
            ? `${name} was rejected`
            : `Asked ${name} for more`,
      );
      setDecided((d) => new Set(d).add(current.id));
      setPicker(null);
      setReason("");
    },
    [current, busy],
  );

  const openPicker = useCallback((kind: Picker) => {
    setPicker(kind);
    setReason("");
    requestAnimationFrame(() => reasonRef.current?.focus());
  }, []);

  // Keyboard shortcuts, ignored while typing a reason.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key === "Escape") return setPicker(null);
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select")) return;
      const key = e.key.toLowerCase();
      if (key === "j") move(1);
      else if (key === "k") move(-1);
      else if (key === "a") void decide("verified");
      else if (key === "r") openPicker("rejected");
      else if (key === "n") openPicker("needs_info");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, decide, openPicker]);

  // New and updated submissions appear without a reload.
  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    void realtimeClient().then((supabase) => {
      if (cancelled) return;
      channel = supabase
        .channel("admin:verifications")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "verification_requests" },
          () => router.refresh(),
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void browserClient().then((s) => s.removeChannel(channel!));
    };
  }, [router]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-large-title">Verification queue</h1>
          <p className="text-sec">
            {queue.length} waiting · {waitingOnStudents} waiting on students
          </p>
        </div>
        <p className="hidden text-[13px] text-sec md:block">
          <kbd>A</kbd> approve · <kbd>R</kbd> reject · <kbd>N</kbd> needs info · <kbd>J</kbd>/
          <kbd>K</kbd> next/previous
        </p>
      </div>

      {!current ? (
        <div className="grid h-72 place-items-center rounded-card bg-surface text-center shadow-card">
          <div>
            <p className="text-lg font-bold">The queue is clear</p>
            <p className="text-sec">New submissions appear here automatically.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <DocViewer url={current.docUrl} path={current.docPath} />

          <aside className="grid content-start gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-sec">
                {Math.min(index, queue.length - 1) + 1} of {queue.length} · submitted{" "}
                {ago(current.updatedAt)}
              </span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Previous" onClick={() => move(-1)}>
                  <ChevronLeft />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Next" onClick={() => move(1)}>
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {current.precheck && <PrecheckPanel p={current.precheck} />}

            <dl className="grid gap-3 rounded-card border border-sep bg-surface p-4">
              <div>
                <dt className="text-[13px] text-sec">Name on submission</dt>
                <dd className="font-semibold">{current.submittedName ?? "—"}</dd>
                {namesDiffer && (
                  <dd className="text-[13px] text-danger">Account name: {current.accountName}</dd>
                )}
              </div>
              <div>
                <dt className="text-[13px] text-sec">Roll / registration number</dt>
                <dd className="font-mono font-semibold tracking-wide">
                  {current.studentId ?? "—"}
                </dd>
                {parts && (
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {parts.map((p) => (
                      <Pill key={p} tone="outline">
                        {p}
                      </Pill>
                    ))}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-[13px] text-sec">
                  {current.emailIsUni ? "UoS email" : "Personal email"}
                </dt>
                <dd className="break-all">{current.email ?? "—"}</dd>
              </div>
              {current.whatsapp && (
                <div>
                  <dt className="text-[13px] text-sec">WhatsApp</dt>
                  <dd>{current.whatsapp}</dd>
                </div>
              )}
            </dl>

            {picker ? (
              <form
                className="grid gap-3 rounded-card border border-sep bg-surface p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void decide(picker, reason);
                }}
              >
                <p className="font-semibold">
                  {picker === "rejected" ? "Why are you rejecting?" : "What do they need to fix?"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES[picker].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReason(t)}
                      className={cn(
                        "rounded-field border px-3 py-2 text-left text-[13px]",
                        reason === t ? "border-accent bg-tint" : "border-sep hover:border-sec/50",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <Textarea
                  ref={reasonRef}
                  aria-label="Reason sent to the student"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="The student sees this in the app and by email."
                />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="md" onClick={() => setPicker(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="md"
                    variant={picker === "rejected" ? "danger" : "primary"}
                    disabled={busy || !reason.trim()}
                    className="flex-1"
                  >
                    {picker === "rejected" ? "Reject" : "Send back"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-2">
                <Button block onClick={() => void decide("verified")} disabled={busy}>
                  <Check /> Approve
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openPicker("needs_info")}
                    disabled={busy}
                  >
                    <HelpCircle /> Needs info
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => openPicker("rejected")}
                    disabled={busy}
                  >
                    <X /> Reject
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** What the AI read from the document. A hint for the reviewer, never a decision. */
function PrecheckPanel({ p }: { p: Precheck }) {
  const pct = Math.round(p.confidence * 100);
  const x = p.extracted;
  return (
    <section
      aria-label="AI pre-check"
      className="grid gap-2 rounded-card border border-sep bg-surface p-4 text-sm"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">AI pre-check</span>
        <Pill tone={pct >= 80 ? "learn" : pct >= 50 ? "neutral" : "help"}>{pct}% match</Pill>
      </div>
      {p.flags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Flags">
          {p.flags.map((f) => (
            <li key={f}>
              <Pill tone="outline" className="text-danger">
                {FLAG_LABELS[f]}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-sec">
        Read from the document: {x.name ?? "no name"} · {x.roll_no ?? "no roll number"} ·{" "}
        {x.university ?? "no university"}
        {x.session ? ` · ${x.session}` : ""}
        {x.department ? ` · ${x.department}` : ""}
      </p>
    </section>
  );
}
