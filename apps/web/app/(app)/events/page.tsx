import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EventCard, type EventItem } from "@/components/events/event-card";
import { EventSheet } from "@/components/events/event-sheet";
import { SocietyButton, SocietySheet } from "@/components/events/society-sheet";
import { Pill } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BellSlot } from "@/components/notifications/bell-slot";

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
    <AppShell>
      <ScreenHeader
        title="Events"
        back="/explore"
        subtitle={<>What&apos;s on at UoS, from societies you trust.</>}
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      {(running.length > 0 || isAdmin) && (
        <EventSheet
          societies={running.map((s) => ({ id: s.id, name: s.name }))}
          campusWide={isAdmin}
        />
      )}

      <SegmentedControl
        label="Event lists"
        value={tab}
        segments={TABS.map((t) => ({
          value: t.key,
          label: t.label,
          href: t.key === "upcoming" ? "/events" : `/events?tab=${t.key}`,
        }))}
      />

      {tab === "societies" ? (
        <>
          <SocietySheet />
          {societies?.length ? (
            <ul className="grid gap-2">
              {societies.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card contrast-more:border contrast-more:border-label"
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
                    <Pill tone="neutral" className="h-6 px-2 text-xs">
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
