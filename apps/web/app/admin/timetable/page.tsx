import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ImportForm } from "@/components/admin/timetable-import";
import { TimetableReports, type TimetableReport } from "@/components/admin/timetable-reports";
import { Pill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";
import { importStatusLabel, summaryLine } from "@/lib/timetable/format";

export const metadata: Metadata = { title: "Timetables", robots: { index: false } };

/** Phase 11.1: data editors import department timetables, review the diff and publish. */
export default async function TimetableImportsPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) notFound();
  const isAdmin = profile.role === "admin";

  const [{ data: editorOf }, { data: allDepartments }, { data: terms }, { data: term }] =
    await Promise.all([
      supabase.from("data_editors").select("department_id, scopes").eq("user_id", user.id),
      supabase.from("departments").select("id, name, short_code").order("name"),
      supabase.from("academic_terms").select("code, name, starts_on").order("starts_on"),
      supabase.rpc("current_term"),
    ]);
  const editable = new Set(
    (editorOf ?? []).filter((e) => e.scopes.includes("timetable")).map((e) => e.department_id),
  );
  const departments = (allDepartments ?? []).filter((d) => isAdmin || editable.has(d.id));
  if (!departments.length) notFound();
  // CS first (the owner's choice), then the rest by name.
  departments.sort((a, b) => Number(b.short_code === "CS") - Number(a.short_code === "CS"));

  const [{ data: imports }, { data: reports }] = await Promise.all([
    supabase
      .from("timetable_imports")
      .select(
        "id, created_at, term, week_of, source_kind, source_name, status, diff_summary, published_at, department:departments(short_code)",
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.rpc("timetable_report_queue"),
  ]);

  return (
    <AdminShell current="/admin/timetable" isAdmin={isAdmin} back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Timetables</h1>
        <p className="text-sec">
          Upload a department&apos;s timetable, check what changed, then publish. Students see
          nothing until you publish.
        </p>
      </div>

      {(reports?.length ?? 0) > 0 && (
        <section aria-labelledby="wrong-info" className="grid gap-2">
          <h2 id="wrong-info" className="text-lg font-bold">
            Wrong info reported · {reports!.length}
          </h2>
          <TimetableReports reports={reports as unknown as TimetableReport[]} />
        </section>
      )}

      <ImportForm
        departments={departments.map((d) => ({
          value: d.id,
          label: `${d.short_code} · ${d.name}`,
        }))}
        terms={(terms ?? []).map((t) => ({ value: t.code, label: t.name }))}
        defaultTerm={term ?? terms?.[0]?.code ?? ""}
      />

      <section aria-labelledby="imports" className="grid gap-2">
        <h2 id="imports" className="text-lg font-bold">
          Imports
        </h2>
        {imports?.length ? (
          <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
            {imports.map((i) => (
              <li key={i.id}>
                <Link href={`/admin/timetable/${i.id}`} className="grid gap-1 p-4 hover:bg-raised">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {i.department?.short_code} · {i.term}
                      {i.week_of ? ` · week of ${i.week_of}` : ""}
                    </span>
                    <Pill tone={i.status === "review" ? "brand" : "neutral"}>
                      {importStatusLabel(i.status)}
                    </Pill>
                  </span>
                  <span className="text-footnote text-sec">
                    {i.source_name ?? i.source_kind} ·{" "}
                    {new Date(i.created_at).toLocaleString("en-PK", {
                      timeZone: "Asia/Karachi",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {i.status === "published" ? ` · ${summaryLine(i.diff_summary)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarClock} title="No imports yet">
            Upload the department&apos;s timetable PDF to get started.
          </EmptyState>
        )}
      </section>
    </AdminShell>
  );
}
