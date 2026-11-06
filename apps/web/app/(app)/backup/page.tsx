import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AskSheet } from "@/components/backup/ask-sheet";
import { BackupAction } from "@/components/backup/backup-actions";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { Avatar } from "@/components/ui/avatar";
import { Pill, Stamp } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import { CATEGORY_LABELS, STATUS_LABELS, URGENCY_LABELS, timeLeft } from "@/lib/backup";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Backup" };

const NEARNESS = ["", "Your section", "Your batch", "Your department", "UoS"];

/** Phase 5 task 4: ask for backup, help a classmate, and keep track of both. */
export default async function BackupPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/backup");

  const [
    { data: open },
    { data: mine },
    { data: helping },
    { data: points },
    { data: courses },
    { data: heroes },
  ] = await Promise.all([
    supabase.rpc("backup_feed", { p_limit: 30 }),
    supabase
      .from("backup_requests")
      .select(
        "id, title, category, status, notified_count, conversation_id, expires_at, created_at",
      )
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("backup_requests")
      .select("id, title, category, status, conversation_id")
      .eq("claimed_by", user.id)
      .eq("status", "claimed")
      .order("claimed_at", { ascending: false }),
    supabase
      .from("backup_points")
      .select("points, helped_count")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("my_courses"),
    supabase.rpc("backup_leaderboard", { p_department_only: false }),
  ]);

  return (
    <AppShell bell>
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-[28px] leading-tight font-bold">Backup</h1>
          <p className="text-ink-2">Ask your classmates, or help one out.</p>
        </div>
        {(points?.helped_count ?? 0) > 0 && (
          <Stamp tone="hero" className="mt-2 shrink-0">
            Helped {points!.helped_count}× · {points!.points} pts
          </Stamp>
        )}
      </div>
      <AskSheet courses={courses ?? []} />
      {(mine?.length ?? 0) > 0 && (
        // The soft ask, once they've asked for backup: now a ping is clearly useful.
        <PushPrompt reason="Get a ping on this phone when someone picks up your request." />
      )}

      {(helping?.length ?? 0) > 0 && (
        <section aria-labelledby="helping" className="grid gap-2">
          <h2 id="helping" className="text-lg font-bold">
            You&apos;re helping
          </h2>
          {helping!.map((r) => (
            <div key={r.id} className="grid gap-2 rounded-lg border border-brand/40 bg-surface p-3">
              <p className="font-semibold">
                {CATEGORY_LABELS[r.category]?.emoji} {r.title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {r.conversation_id && (
                  <Link
                    href={`/chats/${r.conversation_id}`}
                    className="flex h-9 items-center gap-1.5 rounded-pill bg-ink px-4 text-sm font-semibold text-bg"
                  >
                    <MessageCircle className="size-4" /> Open chat
                  </Link>
                )}
                <BackupAction kind="unclaim" request={r.id} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="near" className="grid gap-2">
        <h2 id="near" className="text-lg font-bold">
          Open near you
        </h2>
        {open?.length ? (
          <ul className="grid gap-2">
            {open.map((r) => {
              const name = r.requester_name ?? r.requester_handle ?? "Student";
              return (
                <li key={r.id} className="grid gap-3 rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={name} src={r.requester_avatar} size="md" />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <p className="font-semibold">
                        <span aria-hidden>{CATEGORY_LABELS[r.category]?.emoji} </span>
                        {r.title}
                      </p>
                      {r.details && <p className="text-sm text-ink-2">{r.details}</p>}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Pill tone="brand" className="h-6 px-2 text-xs">
                          {NEARNESS[r.nearness] ?? "UoS"}
                        </Pill>
                        <Pill
                          tone={r.urgency === 3 ? "help" : "neutral"}
                          className="h-6 px-2 text-xs"
                        >
                          {URGENCY_LABELS[r.urgency]}
                        </Pill>
                        <Pill tone="outline" className="h-6 px-2 text-xs">
                          {timeLeft(r.expires_at)}
                        </Pill>
                      </div>
                      <p className="text-xs text-ink-2">
                        {name}
                        {r.course_code && ` · ${r.course_code}`}
                      </p>
                    </div>
                  </div>
                  <BackupAction kind="claim" request={r.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
            No open requests near you right now.
          </p>
        )}
      </section>

      {(mine?.length ?? 0) > 0 && (
        <section aria-labelledby="mine" className="grid gap-2">
          <h2 id="mine" className="text-lg font-bold">
            Your requests
          </h2>
          <ul className="grid gap-2">
            {mine!.map((r) => {
              const active = r.status === "open" || r.status === "claimed";
              return (
                <li
                  key={r.id}
                  className={cn(
                    "grid gap-2 rounded-lg border border-line bg-surface p-3",
                    !active && "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {CATEGORY_LABELS[r.category]?.emoji} {r.title}
                    </p>
                    <Pill
                      tone={r.status === "claimed" ? "brand" : "outline"}
                      className="h-6 shrink-0 px-2 text-xs"
                    >
                      {STATUS_LABELS[r.status]}
                    </Pill>
                  </div>
                  {r.status === "open" && (
                    <p className="text-xs text-ink-2">
                      Sent to {r.notified_count}{" "}
                      {r.notified_count === 1 ? "classmate" : "classmates"} ·{" "}
                      {timeLeft(r.expires_at)}
                    </p>
                  )}
                  {active && (
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === "claimed" && r.conversation_id && (
                        <Link
                          href={`/chats/${r.conversation_id}`}
                          className="flex h-9 items-center gap-1.5 rounded-pill bg-ink px-4 text-sm font-semibold text-bg"
                        >
                          <MessageCircle className="size-4" /> Open chat
                        </Link>
                      )}
                      {r.status === "claimed" && <BackupAction kind="resolve" request={r.id} />}
                      <BackupAction kind="cancel" request={r.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(heroes?.length ?? 0) > 0 && (
        <section aria-labelledby="heroes" className="grid gap-2">
          <h2 id="heroes" className="text-lg font-bold">
            Backup Heroes this month
          </h2>
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {heroes!.slice(0, 10).map((h) => (
              <li key={h.user_id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 text-center font-bold text-ink-2 tabular-nums">{h.rank}</span>
                <Avatar name={h.full_name ?? "Student"} src={h.avatar_url} size="sm" />
                <Link href={`/people/${h.handle}`} className="min-w-0 flex-1 truncate font-medium">
                  {h.full_name}
                  {h.department && <span className="text-ink-2"> · {h.department}</span>}
                </Link>
                <span className="text-sm font-semibold tabular-nums">
                  {h.helped} {h.helped === 1 ? "save" : "saves"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </AppShell>
  );
}
