import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BuddyChat } from "@/components/buddy/buddy-chat";
import { BuddyComingSoon } from "@/components/buddy/coming-soon";
import { Button } from "@/components/ui/button";
import type { Source } from "@/lib/ai/buddy";
import { aiEnabled } from "@/lib/ai/claude.server";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Buddy" };

type Props = { searchParams: Promise<{ thread?: string; course?: string }> };

/** Phase 7 task 3: AI Buddy, a tutor that answers from your course files. */
export default async function BuddyPage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/buddy");
  if (!aiEnabled()) {
    const { data: waitlisted } = await supabase
      .from("feature_waitlist")
      .select("feature")
      .eq("user_id", user.id)
      .eq("feature", "aibuddy")
      .maybeSingle();
    return (
      <AppShell bell back="/explore">
        <h1 className="text-large-title">AIBuddy</h1>
        <BuddyComingSoon waiting={!!waitlisted} />
      </AppShell>
    );
  }
  const { thread, course } = await searchParams;
  const threadId = thread && /^[0-9a-f-]{36}$/.test(thread) ? thread : null;

  const [{ data: courses }, { data: threads }, { data: remaining }, { data: limit }, current] =
    await Promise.all([
      supabase.rpc("my_courses"),
      supabase
        .from("ai_threads")
        .select("id, title, updated_at, course_id")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase.rpc("ai_remaining", { p_kind: "buddy" }),
      supabase.rpc("ai_limit", { p_kind: "buddy" }),
      threadId
        ? Promise.all([
            supabase.from("ai_threads").select("id, course_id").eq("id", threadId).maybeSingle(),
            supabase
              .from("ai_messages")
              .select("role, content, sources")
              .eq("thread_id", threadId)
              .order("created_at"),
          ])
        : Promise.resolve(null),
    ]);
  const open = current?.[0].data ?? null;
  const turns = (current?.[1].data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    sources: (m.sources ?? []) as Source[],
  }));

  return (
    <AppShell bell back="/explore">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-large-title">AI Buddy</h1>
          <p className="text-sec">Answers from your course files, with sources.</p>
        </div>
        {open && (
          <Button asChild size="sm" variant="tinted">
            <Link href="/buddy">
              <Plus /> New chat
            </Link>
          </Button>
        )}
      </div>

      <BuddyChat
        key={open?.id ?? "new"}
        courses={courses ?? []}
        courseId={open?.course_id ?? (course && /^[0-9a-f-]{36}$/.test(course) ? course : null)}
        threadId={open?.id ?? null}
        initialTurns={turns}
        remaining={remaining ?? 0}
        limit={limit ?? 30}
      />

      {(threads?.length ?? 0) > 0 && (
        <section aria-labelledby="past-chats" className="grid gap-2">
          <h2 id="past-chats" className="text-lg font-bold">
            Past chats
          </h2>
          <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface">
            {threads!.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/buddy?thread=${t.id}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 hover:bg-raised",
                    t.id === open?.id && "bg-tint",
                  )}
                >
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-sec">{shortTime(t.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
