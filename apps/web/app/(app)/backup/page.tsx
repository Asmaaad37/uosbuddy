import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ShieldCheck, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AskCard } from "@/components/backup/ask-sheet";
import { BackupAction } from "@/components/backup/backup-actions";
import { BellSlot } from "@/components/notifications/bell-slot";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getSession } from "@/lib/auth/session";
import { CATEGORY_LABELS, STATUS_LABELS, URGENCY_LABELS, timeLeft } from "@/lib/backup";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Backup" };

const NEARNESS = ["", "Your section", "Your batch", "Your department", "UoS"];

/** A small quiet tag on a request card. */
function Tag({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-pill px-2 text-footnote",
        strong ? "bg-tint font-semibold text-tint-text" : "bg-raised text-sec",
      )}
    >
      {children}
    </span>
  );
}

function OpenChat({ id }: { id: string }) {
  return (
    <Button asChild size="sm" variant="tinted">
      <Link href={`/chats/${id}`}>
        <MessageCircle aria-hidden /> Open chat
      </Link>
    </Button>
  );
}

/** Backup (redesign §5.3): ask, help someone near you, and this month's heroes. */
export default async function BackupPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/backup");

  const [
    { data: open },
    { data: mine },
    { data: helping },
    { data: points },
    { data: courses },
    { data: heroes },
    { data: dept },
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
    profile.department_id
      ? supabase
          .from("departments")
          .select("short_code")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const code = dept?.short_code ?? null;
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "Asia/Karachi",
  }).format(new Date());

  return (
    <AppShell>
      <ScreenHeader
        title="Backup"
        subtitle="Stuck on something? Your batch has your back."
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      {(points?.helped_count ?? 0) > 0 && (
        <p className="-mt-3 flex">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-tint px-3 text-footnote font-semibold text-tint-text">
            <Trophy className="size-3.5" aria-hidden />
            Helped {points!.helped_count}× · {points!.points} pts
          </span>
        </p>
      )}

      <AskCard courses={courses ?? []} department={code} />
      {(mine?.length ?? 0) > 0 && (
        // The soft ask, once they've asked for backup: now a ping is clearly useful.
        <PushPrompt reason="Get a ping on this phone when someone picks up your request." />
      )}

      {(helping?.length ?? 0) > 0 && (
        <section aria-labelledby="helping" className="grid gap-3">
          <SectionHeader id="helping" title="You're helping" />
          <ul className="grid gap-3">
            {helping!.map((r) => (
              <li key={r.id}>
                <Card className="grid gap-3">
                  <p className="text-headline">{r.title}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.conversation_id && <OpenChat id={r.conversation_id} />}
                    <BackupAction kind="unclaim" request={r.id} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="near" className="grid gap-3">
        <SectionHeader id="near" title="Open near you" />
        {open?.length ? (
          <ul className="grid gap-3">
            {open.map((r) => {
              const name = r.requester_name ?? r.requester_handle ?? "Student";
              return (
                <li key={r.id}>
                  <Card className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <Avatar name={name} src={r.requester_avatar} size={40} />
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className="text-headline">{r.title}</p>
                        <p className="text-footnote text-ter">
                          {name} · {CATEGORY_LABELS[r.category]?.label ?? "Backup"}
                        </p>
                        {r.details && <p className="text-subhead text-sec">{r.details}</p>}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Tag strong>{NEARNESS[r.nearness] ?? "UoS"}</Tag>
                          {r.course_code && <Tag>{r.course_code}</Tag>}
                          <Tag strong={r.urgency === 3}>{URGENCY_LABELS[r.urgency]}</Tag>
                          <Tag>{timeLeft(r.expires_at)}</Tag>
                        </div>
                      </div>
                    </div>
                    <BackupAction kind="claim" request={r.id} />
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="All quiet right now"
            action={
              <Button asChild variant="plain" size="sm">
                <Link href="/me/notifications">Notification settings</Link>
              </Button>
            }
          >
            We&apos;ll ping you when someone needs a hand.
          </EmptyState>
        )}
      </section>

      {(mine?.length ?? 0) > 0 && (
        <section aria-labelledby="mine" className="grid gap-3">
          <SectionHeader id="mine" title="Your requests" />
          <ul className="grid gap-3">
            {mine!.map((r) => {
              const active = r.status === "open" || r.status === "claimed";
              return (
                <li key={r.id}>
                  <Card className={cn("grid gap-2", !active && "opacity-70")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-headline">{r.title}</p>
                      <Pill
                        tone={r.status === "claimed" ? "brand" : "outline"}
                        className="h-6 shrink-0 px-2 text-footnote"
                      >
                        {STATUS_LABELS[r.status]}
                      </Pill>
                    </div>
                    {r.status === "open" && (
                      <p className="text-footnote text-ter">
                        Sent to {r.notified_count}{" "}
                        {r.notified_count === 1 ? "classmate" : "classmates"} ·{" "}
                        {timeLeft(r.expires_at)}
                      </p>
                    )}
                    {active && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {r.status === "claimed" && r.conversation_id && (
                          <OpenChat id={r.conversation_id} />
                        )}
                        {r.status === "claimed" && <BackupAction kind="resolve" request={r.id} />}
                        <BackupAction kind="cancel" request={r.id} />
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="heroes" className="grid gap-3">
        <SectionHeader
          id="heroes"
          title="Backup heroes"
          trailing={<span className="text-sec">{month}</span>}
        />
        <Card className="grid gap-1 py-2 sm:py-3">
          {(heroes?.length ?? 0) > 0 && (
            <ol>
              {heroes!.slice(0, 10).map((h) => (
                <li key={h.user_id}>
                  <Link
                    href={`/people/${h.handle}`}
                    className="flex min-h-[60px] items-center gap-3 rounded-well py-2 active:bg-raised"
                  >
                    <span className="w-5 text-center text-headline text-sec tabular-nums">
                      {h.rank}
                    </span>
                    <Avatar name={h.full_name ?? "Student"} src={h.avatar_url} size={40} />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-body">{h.full_name}</span>
                      {(h.department || h.batch_year) && (
                        <span className="text-footnote text-ter">
                          {[h.department, h.batch_year].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="rounded-pill bg-tint px-2.5 py-1 text-footnote font-semibold text-tint-text tabular-nums">
                      {h.helped} {h.helped === 1 ? "save" : "saves"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <p className="py-2 text-center text-footnote text-sec">
            {(heroes?.length ?? 0) > 0
              ? "Help someone this month to join the list."
              : "No saves yet. Help someone to top the list."}
          </p>
        </Card>
      </section>
    </AppShell>
  );
}
