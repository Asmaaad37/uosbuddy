import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileSearch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResourceResults, ResourceSearch } from "@/components/resources/resource-hub";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth/session";
import { RESOURCE_KINDS, type ResourceKind } from "@/lib/academics";

export const metadata: Metadata = { title: "Resources" };

type Props = { searchParams: Promise<{ q?: string; kind?: string; year?: string }> };

/** PostgREST filter syntax uses , ( ) * and quotes; keep the search to plain words. */
const clean = (q: string) =>
  q
    .replace(/[^\p{L}\p{N}\s.+#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

/**
 * Feature #80: the Resources hub. One search across every course's shared files at UoS —
 * by course code or title, file title, or teacher — with kind and year filters.
 */
export default async function ResourcesPage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/resources");
  const params = await searchParams;
  const q = clean(params.q ?? "");
  const kind = params.kind && params.kind in RESOURCE_KINDS ? (params.kind as ResourceKind) : null;
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : null;

  // Courses whose code or title match, so "CS-301" or "data structures" finds their files.
  let courseIds: string[] = [];
  if (q) {
    const { data: courses } = await supabase
      .from("courses")
      .select("id")
      .or(`code.ilike.*${q}*,title.ilike.*${q}*`)
      .limit(200);
    courseIds = (courses ?? []).map((c) => c.id);
  }

  let query = supabase
    .from("resources")
    .select(
      "id, kind, title, file_path, mime_type, size_bytes, year, teacher_name, upvotes, uploader_id, course:courses(id, code, title)",
    )
    .eq("status", "published")
    .order("upvotes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) {
    const terms = [`title.ilike.*${q}*`, `teacher_name.ilike.*${q}*`];
    if (courseIds.length) terms.push(`course_id.in.(${courseIds.join(",")})`);
    query = query.or(terms.join(","));
  }
  if (kind) query = query.eq("kind", kind);
  if (year) query = query.eq("year", year);

  const [{ data: rows, error }, { data: votes }, { data: years }] = await Promise.all([
    query,
    supabase.from("resource_votes").select("resource_id").eq("user_id", user.id),
    supabase
      .from("resources")
      .select("year")
      .eq("status", "published")
      .not("year", "is", null)
      .order("year", { ascending: false })
      .limit(500),
  ]);
  const voted = new Set((votes ?? []).map((v) => v.resource_id));
  const items = (rows ?? []).map((r) => {
    const course = Array.isArray(r.course) ? r.course[0] : r.course;
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      file_path: r.file_path,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      year: r.year,
      teacher_name: r.teacher_name,
      upvotes: r.upvotes,
      voted: voted.has(r.id),
      mine: r.uploader_id === user.id,
      course: course ? { id: course.id, code: course.code, title: course.title } : null,
    };
  });
  const yearOptions = [...new Set((years ?? []).map((y) => y.year as number))];
  const filtered = !!(q || kind || year);

  return (
    <AppShell back="/courses" backLabel="Courses">
      <div className="grid gap-1">
        <h1 className="text-large-title">Resources</h1>
        <p className="text-body text-sec">
          Notes, past papers and outlines shared for every course at UoS.
        </p>
      </div>
      <ResourceSearch q={params.q ?? ""} kind={kind} year={year} years={yearOptions} />
      {error ? (
        <p role="alert" className="rounded-card bg-surface p-4 text-subhead text-danger">
          Couldn&apos;t search right now. Try again.
        </p>
      ) : items.length ? (
        <ResourceResults key={`${q}|${kind}|${year}`} items={items} />
      ) : (
        <EmptyState icon={FileSearch} title={filtered ? "Nothing matches" : "No files yet"}>
          {filtered
            ? "Try a course code like CS-301, a teacher's name, or fewer filters."
            : "When students share notes and past papers in their course rooms, they show up here."}
        </EmptyState>
      )}
    </AppShell>
  );
}
