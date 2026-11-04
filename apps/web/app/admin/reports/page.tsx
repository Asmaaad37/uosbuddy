import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { ReportItem, type QueueRow } from "@/components/admin/report-item";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };

/** Phase 9 tasks 1–2: reported and held content, for admins and student moderators. */
export default async function ReportsPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin" && profile?.role !== "moderator") notFound();
  const isAdmin = profile.role === "admin";
  const { data: rows } = await supabase.rpc("moderation_queue");

  return (
    <AdminShell current="/admin/reports" isAdmin={isAdmin} back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Reports</h1>
        <p className="text-ink-2">
          {isAdmin
            ? "Everything reported or held for review, most-reported first."
            : "Reported or held posts and comments in the feeds you moderate."}{" "}
          Every action is recorded.
        </p>
      </div>
      {rows?.length ? (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <ReportItem
              key={`${r.target_type}:${r.target_id}`}
              row={r as QueueRow}
              isAdmin={isAdmin}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-ink-2">
          Nothing to review. Nice.
        </p>
      )}
    </AdminShell>
  );
}
