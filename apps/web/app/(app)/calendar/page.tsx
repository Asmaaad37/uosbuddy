import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getSession } from "@/lib/auth/session";
import { pakistanToday, type CalendarEvent } from "@/lib/calendar";

export const metadata: Metadata = { title: "Academic calendar" };

/** Phase 11.4: the university's academic calendar, with reminders and phone export. */
export default async function CalendarPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/calendar");
  const [{ data: events }, { data: reminders }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, term, kind, title, notes, starts_on, ends_on, tentative")
      .eq("status", "published")
      .order("starts_on"),
    supabase.from("calendar_reminders").select("event_id").eq("user_id", user.id),
  ]);

  return (
    <AppShell>
      <ScreenHeader
        title="Academic calendar"
        back="/explore"
        subtitle="From the university's official calendar."
      />
      {events?.length ? (
        <CalendarView
          events={events as CalendarEvent[]}
          reminders={(reminders ?? []).map((r) => r.event_id)}
          today={pakistanToday()}
        />
      ) : (
        <EmptyState icon={CalendarDays} title="No dates yet">
          The academic calendar appears here once it&apos;s published.
        </EmptyState>
      )}
    </AppShell>
  );
}
