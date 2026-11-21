import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { FreeNow } from "@/components/timetable/free-now";
import { FreeRoomFinder } from "@/components/timetable/free-rooms";
import { Lookup } from "@/components/timetable/lookup";
import { ImportTimetable } from "@/components/timetable/import";
import { OfficialWeek } from "@/components/timetable/official-week";
import { FreeTogether } from "@/components/timetable/together";
import { Week } from "@/components/timetable/week";
import { termLabel } from "@/lib/academics";
import { aiEnabled } from "@/lib/ai/claude.server";
import { getSession } from "@/lib/auth/session";
import type { MyTimetable } from "@/lib/timetable/week";
import { SectionHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BellSlot } from "@/components/notifications/bell-slot";

export const metadata: Metadata = { title: "Timetable" };

// "Free together" and "Free now" live under People, as chips (Phase 11.3).
const TABS = [
  { key: "week", label: "My week" },
  { key: "lookup", label: "Lookup" },
  { key: "rooms", label: "Rooms" },
  { key: "people", label: "People" },
] as const;
const PEOPLE = [
  { key: "together", label: "Free together" },
  { key: "now", label: "Free now" },
] as const;
type Tab = "week" | "lookup" | "rooms" | "together" | "now";

type Props = { searchParams: Promise<{ tab?: string }> };

/**
 * Phase 6 tasks 5–6: your week, free time with friends, and who's free right now.
 * Phase 11.2: My week shows your section's official timetable first, then your own classes.
 * Phase 11.3: Lookup (any section, teacher or room) and free rooms.
 */
export default async function TimetablePage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/login?next=/timetable");
  const tabParam = (await searchParams).tab;
  const tab: Tab =
    tabParam === "people"
      ? "together"
      : ["lookup", "rooms", "together", "now"].includes(tabParam ?? "")
        ? (tabParam as Tab)
        : "week";
  const segment = tab === "together" || tab === "now" ? "people" : tab;
  const { data: term } = await supabase.rpc("current_term");

  const [
    { data: slots },
    { data: courses },
    { data: connections },
    { data: free },
    { data: privacy },
    { data: presence },
    { data: official },
    { data: groups },
    { data: teachers },
    { data: rooms },
    { data: busy },
  ] = await Promise.all([
    tab === "week"
      ? supabase
          .from("timetable_slots")
          .select("id, day, start_min, end_min, label, room, course_id")
          .eq("user_id", user.id)
          .eq("term", term ?? "")
      : Promise.resolve({ data: [] }),
    tab === "week" ? supabase.rpc("my_courses") : Promise.resolve({ data: [] }),
    tab === "together" ? supabase.rpc("my_connections") : Promise.resolve({ data: [] }),
    tab === "now" ? supabase.rpc("free_now") : Promise.resolve({ data: [] }),
    tab === "now"
      ? supabase
          .from("privacy_settings")
          .select("show_free_now")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tab === "now"
      ? supabase.from("presence").select("on_campus_until").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    tab === "week" ? supabase.rpc("my_timetable") : Promise.resolve({ data: null }),
    tab === "week" || tab === "lookup"
      ? supabase.rpc("timetable_groups")
      : Promise.resolve({ data: [] }),
    tab === "lookup" ? supabase.rpc("timetable_teachers") : Promise.resolve({ data: [] }),
    tab === "lookup" || tab === "rooms"
      ? supabase.rpc("timetable_rooms")
      : Promise.resolve({ data: [] }),
    tab === "rooms"
      ? supabase.rpc("live_entries").select("room_id, day, start_min, end_min")
      : Promise.resolve({ data: [] }),
  ]);
  const myTimetable = official as unknown as MyTimetable | null;
  const published = (groups ?? []).some((g) => g.department_id === profile?.department_id);

  return (
    <AppShell>
      <ScreenHeader
        title="Timetable"
        back="/explore"
        subtitle={termLabel(term)}
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      <SegmentedControl
        label="Timetable sections"
        value={segment}
        segments={TABS.map((t) => ({
          value: t.key,
          label: t.label,
          href: t.key === "week" ? "/timetable" : `/timetable?tab=${t.key}`,
        }))}
      />
      {segment === "people" && (
        <nav aria-label="People" className="flex gap-2">
          {PEOPLE.map((p) => (
            <Link
              key={p.key}
              href={`/timetable?tab=${p.key}`}
              aria-current={tab === p.key ? "page" : undefined}
              className={cn(
                "hit inline-flex h-9 items-center rounded-pill px-3.5 text-subhead shadow-card",
                tab === p.key
                  ? "bg-midnight font-semibold text-on-fill"
                  : "bg-surface font-medium text-label hover:bg-raised",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      )}
      {tab === "lookup" && (
        <Lookup
          options={{
            section: (groups ?? []).map((g) => ({ id: g.id, label: g.label })),
            teacher: (teachers ?? []).map((t) => ({
              id: t.id,
              label: t.department ? `${t.name} · ${t.department}` : t.name,
            })),
            room: (rooms ?? []).map((r) => ({ id: r.id, label: r.label })),
          }}
        />
      )}
      {tab === "rooms" && (
        <FreeRoomFinder
          rooms={(rooms ?? []).map((r) => ({
            id: r.id,
            label: r.label,
            building: r.building,
            floor: r.floor,
            kind: r.kind,
          }))}
          busy={busy ?? []}
        />
      )}
      {tab === "week" && myTimetable && (
        <OfficialWeek
          data={myTimetable}
          groups={(groups ?? []).map((g) => ({ id: g.id, label: g.label }))}
          published={published}
          term={termLabel(term)}
        />
      )}
      {tab === "week" && (
        <section aria-labelledby="own-classes" className="grid gap-3">
          <SectionHeader id="own-classes" title="Your own classes" />
          <p className="-mt-2 px-1 text-footnote text-sec">
            Extra classes or study blocks. Only you see these.
          </p>
          {aiEnabled() && <ImportTimetable />}
          <Week slots={slots ?? []} courses={courses ?? []} />
        </section>
      )}
      {tab === "together" && <FreeTogether connections={connections ?? []} />}
      {tab === "now" && (
        <FreeNow
          people={free ?? []}
          showMe={!!privacy?.show_free_now}
          onCampusUntil={presence?.on_campus_until ?? null}
        />
      )}
    </AppShell>
  );
}
