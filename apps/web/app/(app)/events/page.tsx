import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EventCard, type EventItem } from "@/components/events/event-card";
import { EventSheet } from "@/components/events/event-sheet";
import { SocietyButton, SocietySheet } from "@/components/events/society-sheet";
import { Pill } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Events" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "going", label: "My events" },
  { key: "societies", label: "Societies" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string }> };

/** Phase 8 task 3: what's on at UoS, and the societies behind it. */
export default async function EventsPage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/login?next=/events");
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "upcoming";
  const isAdmin = profile?.role === "admin";

  const [{ data: events }, { data: societies }] = await Promise.all([
    tab === "societies"
      ? Promise.resolve({ data: [] })
      : supabase.rpc("events_board", { p_mine: tab === "going" }),
    supabase.rpc("societies_list"),
  ]);
  const running = (societies ?? []).filter((s) => s.my_role === "admin" && s.verified);

  return (
    <AppShell bell back="/explore">
      <div className="grid gap-1">
        <h1 className="text-large-title">Events</h1>
        <p className="text-sec">What&apos;s on at UoS, from societies you trust.</p>
      </div>
      {(running.length > 0 || isAdmin) && (
        <EventSheet
          societies={running.map((s) => ({ id: s.id, name: s.name }))}
          campusWide={isAdmin}
        />
      )}

      <nav aria-label="Event lists" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "upcoming" ? "/events" : `/events?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "hit flex h-10 shrink-0 items-center rounded-pill border px-4 text-sm font-semibold",
              tab === t.key
                ? "border-accent bg-tint text-tint-text"
                : "border-sep text-label hover:bg-raised",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "societies" ? (
        <>
          <SocietySheet />
          {societies?.length ? (
            <ul className="grid gap-2">
              {societies.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-card border border-sep bg-surface p-3"
                >
                  <span
                    aria-hidden
                    className="grid size-11 shrink-0 place-items-center rounded-field bg-raised text-xl text-sec"
                  >
                    {s.emoji || s.name.slice(0, 1)}
                  </span>
                  <Link href={`/events/s/${s.slug}`} className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">{s.name}</span>
                    <span className="text-xs text-sec">
                      {s.member_count} {s.member_count === 1 ? "member" : "members"}
                    </span>
                  </Link>
                  {!s.verified ? (
                    <Pill tone="outline" className="h-6 px-2 text-xs">
                      Awaiting check
                    </Pill>
                  ) : s.my_role ? (
                    <Pill tone="learn" className="h-6 px-2 text-xs">
                      {s.my_role === "admin" ? "Admin" : "Member"}
                    </Pill>
                  ) : (
                    <SocietyButton society={s.id} kind="join" />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarDays}>No societies yet. Run one? Start its page.</EmptyState>
          )}
        </>
      ) : events?.length ? (
        <div className="grid gap-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e as EventItem} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays}>
          {tab === "going"
            ? "Events you're going to or interested in show up here."
            : "No upcoming events yet."}
        </EmptyState>
      )}
    </AppShell>
  );
}
