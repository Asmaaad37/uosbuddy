import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ExcludeToggle, ImportActions } from "@/components/admin/timetable-import";
import { Pill } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";
import {
  DAY_NAMES,
  changeLine,
  hhmm,
  importStatusLabel,
  summaryLine,
  type Slot,
} from "@/lib/timetable/format";

export const metadata: Metadata = { title: "Review timetable", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

const KIND_ORDER = ["moved", "retimed", "teacher", "removed", "added"] as const;
const KIND_TITLE: Record<string, string> = {
  moved: "Moved room",
  retimed: "New day or time",
  teacher: "New teacher",
  removed: "Removed",
  added: "Added",
};

type Report = {
  summary?: { pages: number; rooms: number; sessions: number; warnings: number };
  warnings?: { type: string; day?: string; lines?: string[] }[];
  skipped?: { day: string; room: string; reason: string; lines: string[] }[];
  rows?: number;
};

/** Phase 11.1: review one import: what it changes, what couldn't be read, then publish. */
export default async function ReviewImportPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) notFound();

  const { data: imp } = await supabase
    .from("timetable_imports")
    .select(
      "id, created_at, term, week_of, source_kind, source_name, parser_version, status, report, diff_summary, published_at, department:departments(short_code, name)",
    )
    .eq("id", id)
    .maybeSingle();
  // RLS shows imports only to the department's editors (and admins).
  if (!imp) notFound();

  const [{ data: entries }, diff, { data: changes }] = await Promise.all([
    supabase
      .from("timetable_entries")
      .select(
        "id, class_group_id, course_title, course_code, room_label, teacher_name, day, start_min, end_min, practical, excluded, live, class_group:class_groups(label)",
      )
      .eq("import_id", id)
      .order("day")
      .order("start_min"),
    imp.status === "review"
      ? supabase.rpc("import_diff", { p_import: id })
      : Promise.resolve({ data: null }),
    imp.status === "published"
      ? supabase
          .from("timetable_changes")
          .select("kind, before, after, class_group_id")
          .eq("import_id", id)
      : Promise.resolve({ data: null }),
  ]);
  const rows = (diff.data ?? changes ?? []) as {
    kind: string;
    before: unknown;
    after: unknown;
    class_group_id: string | null;
  }[];
  const live = (entries ?? []).some((e) => e.live);
  const report = (imp.report ?? {}) as Report;
  const groups = new Map<string, NonNullable<typeof entries>>();
  for (const e of entries ?? []) {
    const label = e.class_group?.label ?? "Unknown group";
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }
  const groupLabel = new Map((entries ?? []).map((e) => [e.class_group_id, e.class_group?.label]));
  const counts = Object.fromEntries(
    KIND_ORDER.map((k) => [k, rows.filter((r) => r.kind === k).length]),
  );

  return (
    <AdminShell
      current="/admin/timetable"
      isAdmin={profile.role === "admin"}
      back={homePath(profile)}
      wide
    >
      <BackLink href="/admin/timetable">Timetables</BackLink>
      <div className="grid gap-2">
        <h1 className="text-[28px] font-bold">
          {imp.department?.short_code} · {imp.term}
          {imp.week_of ? ` · week of ${imp.week_of}` : ""}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sec">
          <Pill tone={imp.status === "review" ? "brand" : "neutral"}>
            {importStatusLabel(imp.status)}
          </Pill>
          {live && <Pill tone="brand">Live</Pill>}
          <span>
            {imp.source_name ?? imp.source_kind} · {(entries ?? []).length} classes ·{" "}
            {imp.status === "review" ? summaryLine(counts) : summaryLine(imp.diff_summary)}
          </span>
        </p>
        <ImportActions importId={imp.id} status={imp.status} live={live} changes={rows.length} />
      </div>

      {(report.skipped?.length ?? 0) > 0 && (
        <section aria-labelledby="skipped" className="grid gap-2">
          <h2 id="skipped" className="text-lg font-bold">
            Couldn&apos;t place {report.skipped!.length} class
            {report.skipped!.length === 1 ? "" : "es"}
          </h2>
          <p className="text-sec">
            These aren&apos;t in the import. Usually a program from another department; add it to
            the catalogue and upload again if it belongs here.
          </p>
          <ul className="divide-y divide-sep rounded-card bg-surface text-subhead shadow-card">
            {report.skipped!.map((s, i) => (
              <li key={i} className="grid gap-0.5 p-3">
                <span className="font-semibold">{s.reason}</span>
                <span className="text-footnote text-sec">
                  {s.day} · {s.room} · {s.lines.join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(report.warnings?.length ?? 0) > 0 && (
        <section aria-labelledby="warnings" className="grid gap-2">
          <h2 id="warnings" className="text-lg font-bold">
            Parser warnings
          </h2>
          <ul className="grid gap-1 text-footnote text-sec">
            {report.warnings!.map((w, i) => (
              <li key={i}>
                {w.type.replaceAll("_", " ")}
                {w.day ? ` · ${w.day}` : ""}
                {w.lines ? ` · ${w.lines.join(" · ")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="changes" className="grid gap-3">
        <h2 id="changes" className="text-lg font-bold">
          {imp.status === "review" ? "What publishing changes" : "What changed"}
        </h2>
        {rows.length === 0 && <p className="text-sec">No changes from what&apos;s live.</p>}
        {KIND_ORDER.filter((k) => counts[k]).map((kind) => (
          <details
            key={kind}
            open={kind !== "added" || rows.length < 40}
            className="rounded-card bg-surface shadow-card"
          >
            <summary className="cursor-pointer p-4 font-semibold">
              {KIND_TITLE[kind]} ({counts[kind]})
            </summary>
            <ul className="divide-y divide-sep border-t border-sep text-subhead">
              {rows
                .filter((r) => r.kind === kind)
                .map((r, i) => (
                  <li key={i} className="grid gap-0.5 px-4 py-2.5">
                    <span>{changeLine(kind, r.before as Slot | null, r.after as Slot | null)}</span>
                    <span className="text-footnote text-sec">
                      {groupLabel.get(r.class_group_id ?? "") ?? ""}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        ))}
      </section>

      <section aria-labelledby="classes" className="grid gap-3">
        <h2 id="classes" className="text-lg font-bold">
          Classes by group
        </h2>
        {[...groups.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, list]) => (
            <details key={label} className="rounded-card bg-surface shadow-card">
              <summary className="cursor-pointer p-4 font-semibold">
                {label} ({list.length})
              </summary>
              <ul className="divide-y divide-sep border-t border-sep text-subhead">
                {list.map((e) => (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 ${e.excluded ? "opacity-50" : ""}`}
                  >
                    <span className="grid gap-0.5">
                      <span className={e.excluded ? "line-through" : ""}>
                        {e.course_title}
                        {e.course_code ? ` · ${e.course_code}` : ""}
                        {e.practical ? " · practical" : ""}
                      </span>
                      <span className="text-footnote text-sec">
                        {DAY_NAMES[e.day]} {hhmm(e.start_min)}–{hhmm(e.end_min)} · {e.room_label}
                        {e.teacher_name ? ` · ${e.teacher_name}` : ""}
                      </span>
                    </span>
                    {imp.status === "review" && (
                      <ExcludeToggle entryId={e.id} excluded={e.excluded} />
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
      </section>
    </AdminShell>
  );
}
