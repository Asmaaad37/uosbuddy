"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import type { BuddyEvent } from "@/app/api/buddy/route";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { Source } from "@/lib/ai/buddy";
import { cn } from "@/lib/utils";

type Course = { id: string; code: string; title: string };
type Turn = { role: "user" | "assistant"; content: string; sources: Source[]; pending?: boolean };

/**
 * Phase 7 task 3: chat with AI Buddy about one course. Answers stream in; sources appear
 * under each answer and open the course's files.
 */
export function BuddyChat({
  courses,
  courseId: initialCourse,
  threadId: initialThread,
  initialTurns,
  remaining: initialRemaining,
  limit,
}: {
  courses: Course[];
  courseId: string | null;
  threadId: string | null;
  initialTurns: Turn[];
  remaining: number;
  limit: number;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(initialCourse ?? courses[0]?.id ?? "");
  const [threadId, setThreadId] = useState(initialThread);
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [remaining, setRemaining] = useState(initialRemaining);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [turns]);

  async function ask(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const message = draft.trim();
    if (!message || busy || !courseId) return;
    setDraft("");
    setError(undefined);
    setBusy(true);
    setTurns((t) => [
      ...t,
      { role: "user", content: message, sources: [] },
      { role: "assistant", content: "", sources: [], pending: true },
    ]);
    const patch = (fn: (last: Turn) => Turn) =>
      setTurns((t) => [...t.slice(0, -1), fn(t[t.length - 1]!)]);

    try {
      const res = await fetch("/api/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, threadId: threadId ?? undefined, message }),
      });
      if (!res.ok || !res.body) {
        const { error: msg } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(msg ?? "AI Buddy couldn't answer. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as BuddyEvent;
          if (event.type === "thread" && event.threadId !== threadId) {
            setThreadId(event.threadId);
            window.history.replaceState(null, "", `/buddy?thread=${event.threadId}`);
          } else if (event.type === "text") {
            patch((l) => ({ ...l, content: l.content + event.text }));
          } else if (event.type === "source") {
            patch((l) => ({ ...l, sources: [...l.sources, event.source] }));
          } else if (event.type === "done") {
            setRemaining(event.remaining);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
      patch((l) => ({ ...l, pending: false }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Buddy couldn't answer. Try again.");
      setTurns((t) =>
        t.at(-1)?.content ? t.map((x) => ({ ...x, pending: false })) : t.slice(0, -1),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!courses.length) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
        AI Buddy answers from your course files.{" "}
        <Link href="/courses" className="font-semibold text-brand">
          Add your courses
        </Link>{" "}
        first.
      </p>
    );
  }

  const course = courses.find((c) => c.id === courseId);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {threadId ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BookOpen className="size-4 text-brand" />{" "}
            {course ? `${course.code} · ${course.title}` : "Course"}
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm font-semibold">
            Course
            <NativeSelect
              aria-label="Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-10 w-auto"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <span className="text-sm text-ink-2" aria-live="polite">
          {remaining} of {limit} questions left today
        </span>
      </div>

      <div className="grid gap-4" role="log" aria-live="polite" aria-label="AI Buddy chat">
        {turns.length === 0 && (
          <div className="grid gap-2 rounded-lg border border-line bg-surface p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-brand" /> Ask about your course
            </p>
            <p className="text-sm text-ink-2">
              AI Buddy answers from the notes, past papers and outlines shared in this course, and
              shows where each answer comes from. It explains and teaches, and won&apos;t write
              graded work for you.
            </p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("grid gap-2", t.role === "user" && "justify-items-end")}>
            <div
              className={cn(
                "max-w-[90%] rounded-lg px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                t.role === "user" ? "bg-ink text-bg" : "border border-line bg-surface",
              )}
            >
              {t.content || (t.pending && <Loader2 className="size-4 animate-spin text-ink-2" />)}
            </div>
            {t.role === "assistant" && t.sources.length > 0 && (
              <ol className="grid gap-1.5" aria-label="Sources">
                {t.sources.map((s, n) => (
                  <li key={n}>
                    <Link
                      href={`/courses/${courseId}#r-${s.resourceId}`}
                      className="flex gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm hover:border-ink-2/50"
                    >
                      <span className="font-semibold text-brand">[{n + 1}]</span>
                      <span className="grid min-w-0">
                        <span className="truncate font-semibold">{s.title}</span>
                        <span className="line-clamp-2 text-xs text-ink-2">
                          &ldquo;{s.quote}&rdquo;
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <form onSubmit={ask} className="flex items-end gap-2">
        <textarea
          aria-label="Ask AI Buddy"
          value={draft}
          rows={2}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask();
            }
          }}
          placeholder="Explain how merge sort works"
          className="min-h-12 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-[15px] focus-visible:border-brand focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Ask"
          disabled={busy || !draft.trim() || remaining <= 0}
        >
          {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </div>
  );
}
