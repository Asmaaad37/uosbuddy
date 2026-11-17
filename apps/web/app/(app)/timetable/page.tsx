import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FreeNow } from "@/components/timetable/free-now";
import { ImportTimetable } from "@/components/timetable/import";
import { FreeTogether } from "@/components/timetable/together";
import { Week } from "@/components/timetable/week";
import { termLabel } from "@/lib/academics";
import { aiEnabled } from "@/lib/ai/claude.server";
import { getSession } from "@/lib/auth/session";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BellSlot } from "@/components/notifications/bell-slot";

export const metadata: Metadata = { title: "Timetable" };

const TABS = [
  { key: "week", label: "My week" },
  { key: "together", label: "Free together" },
  { key: "now", label: "Free now" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string }> };

/** Phase 6 tasks 5–6: your week, free time with friends, and who's free right now. */
export default async function TimetablePage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/timetable");
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "week";
  const { data: term } = await supabase.rpc("current_term");

  const [
    { data: slots },
    { data: courses },
    { data: connections },
    { data: free },
    { data: privacy },
    { data: presence },
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
  ]);

  return (
    <AppShell>
      <ScreenHeader
        title="Timetable"
        back="/explore"
        subtitle={<>{termLabel(term)}. Only you see your classes.</>}
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      <SegmentedControl
        label="Timetable sections"
        value={tab}
        segments={TABS.map((t) => ({
          value: t.key,
          label: t.label,
          href: t.key === "week" ? "/timetable" : `/timetable?tab=${t.key}`,
        }))}
      />
      {tab === "week" && aiEnabled() && <ImportTimetable />}
      {tab === "week" && <Week slots={slots ?? []} courses={courses ?? []} />}
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
