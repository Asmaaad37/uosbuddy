import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { CalendarEditor, type EditorEvent } from "@/components/admin/calendar-editor";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar", robots: { index: false } };

/** Phase 11.4: editors keep the academic calendar. Changes are audited in the database. */
export default async function CalendarAdminPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) notFound();
  const isAdmin = profile.role === "admin";
  if (!isAdmin) {
    const { data: editor } = await supabase
      .from("data_editors")
      .select("scopes")
      .eq("user_id", user.id);
    if (!(editor ?? []).some((e) => e.scopes.includes("calendar"))) notFound();
  }
  const [{ data: events }, { data: terms }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, term, kind, title, notes, starts_on, ends_on, tentative, source, status")
      .order("starts_on"),
    supabase.from("academic_terms").select("code, name, starts_on").order("starts_on"),
  ]);

  return (
    <AdminShell current="/admin/calendar" isAdmin={isAdmin} back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Academic calendar</h1>
        <p className="text-sec">
          Students see published dates on their calendar and Explore, and can set reminders. Edits
          are recorded in the audit log.
        </p>
      </div>
      <CalendarEditor
        events={(events ?? []) as EditorEvent[]}
        terms={(terms ?? []).map((t) => ({ code: t.code, name: t.name }))}
      />
    </AdminShell>
  );
}
