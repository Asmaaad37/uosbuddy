import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClassList, type ViewClass } from "@/components/timetable/class-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Timetable" };

const KINDS = ["section", "teacher", "room"] as const;
type Kind = (typeof KINDS)[number];
type View = { title: string; subtitle: string | null; classes: ViewClass[] };

type Props = { params: Promise<{ kind: string; id: string }> };

const EMPTY: Record<Kind, string> = {
  section: "This section has no classes this week.",
  teacher: "No classes this week.",
  room: "No classes in this room this week. It's free whenever the building is open.",
};

/** Phase 11.3: a section's, teacher's or room's week, from the published timetable. */
export default async function TimetableViewPage({ params }: Props) {
  const { kind, id } = await params;
  if (!KINDS.includes(kind as Kind) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/timetable/${kind}/${id}`);
  const { data } = await supabase.rpc("timetable_view", { p_kind: kind, p_id: id });
  const view = data as unknown as View | null;
  if (!view) notFound();

  return (
    <AppShell>
      <ScreenHeader
        title={view.title}
        subtitle={view.subtitle ?? undefined}
        back="/timetable?tab=lookup"
      />
      {view.classes.length ? (
        <ClassList classes={view.classes} hide={kind as Kind} />
      ) : (
        <EmptyState icon={CalendarClock}>{EMPTY[kind as Kind]}</EmptyState>
      )}
    </AppShell>
  );
}
