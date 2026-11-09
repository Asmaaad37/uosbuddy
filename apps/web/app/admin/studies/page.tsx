import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { StudiesQueue, type StudiesItem } from "@/components/admin/studies-queue";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Studies changes", robots: { index: false } };

const DOC_LINK_SECONDS = 15 * 60;

/** Students asking to change department, session, section or shift, with their proof. */
export default async function StudiesChangesPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();

  const { data: rows } = await supabase
    .from("studies_change_requests")
    .select(
      "id, created_at, doc_path, batch_year, section, shift, department:departments(name), program:programs(name), student:profiles!studies_change_requests_user_id_fkey(full_name, handle, batch_year, section, shift, department:departments(name), program:programs(name))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  const paths = (rows ?? []).map((r) => r.doc_path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("verification-docs").createSignedUrls(paths, DOC_LINK_SECONDS)
    : { data: [] };
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const items: StudiesItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.student?.full_name ?? r.student?.handle ?? "Student",
    docPath: r.doc_path,
    docUrl: urls.get(r.doc_path) ?? null,
    changes: [
      ["Department", r.student?.department?.name, r.department?.name],
      ["Program", r.student?.program?.name, r.program?.name],
      ["Session", r.student?.batch_year, r.batch_year],
      ["Section", r.student?.section, r.section],
      ["Shift", r.student?.shift, r.shift],
    ].map(([label, from, to]) => ({
      label: String(label),
      from: from == null ? "None" : String(from),
      to: to == null ? "None" : String(to),
    })),
  }));

  return (
    <AdminShell current="/admin/studies" isAdmin back={homePath(profile)}>
      <h1 className="text-large-title">Studies changes</h1>
      <StudiesQueue items={items} />
    </AdminShell>
  );
}
