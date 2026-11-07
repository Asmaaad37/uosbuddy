import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { FlagToggle } from "@/components/admin/flag-toggle";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Feature flags", robots: { index: false } };

/** Phase 9 task 1: feature flags, enforced in the database (so they can't be skipped). */
export default async function FlagsPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const { data: flags } = await supabase
    .from("feature_flags")
    .select("key, enabled, note")
    .order("key");

  return (
    <AdminShell current="/admin/flags" isAdmin back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Feature flags</h1>
        <p className="text-sec">Changes apply immediately and are recorded in the audit log.</p>
      </div>
      <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface">
        {(flags ?? []).map((f) => (
          <li key={f.key} className="flex items-center gap-4 p-4">
            <div className="grid min-w-0 flex-1">
              <span className="font-mono font-semibold">{f.key}</span>
              {f.note && <span className="text-sm text-sec">{f.note}</span>}
            </div>
            <FlagToggle flag={f.key} enabled={f.enabled} label={f.key} />
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
