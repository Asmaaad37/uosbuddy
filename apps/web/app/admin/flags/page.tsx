import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AnnounceLaunch } from "@/components/admin/announce-launch";
import { FlagToggle } from "@/components/admin/flag-toggle";
import { aiEnabled } from "@/lib/ai/claude.server";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Feature flags", robots: { index: false } };

/** Phase 9 task 1: feature flags, enforced in the database (so they can't be skipped). */
export default async function FlagsPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const [{ data: flags }, { data: pending }] = await Promise.all([
    supabase.from("feature_flags").select("key, enabled, note").order("key"),
    supabase.rpc("waitlist_pending", { p_feature: "aibuddy" }),
  ]);
  const live = aiEnabled();

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

      <section aria-labelledby="launches" className="grid gap-2">
        <h2 id="launches" className="px-1 text-overline text-ter uppercase">
          Launches
        </h2>
        <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-semibold">AIBuddy</span>
            <span className="text-sm text-sec">
              {live
                ? `${pending ?? 0} waiting to hear it's live (tapped "Notify me").`
                : `${pending ?? 0} waiting. AI is off: add the Anthropic key in Vercel, redeploy, then announce.`}
            </span>
          </div>
          <AnnounceLaunch pending={pending ?? 0} live={live} />
        </div>
      </section>
    </AdminShell>
  );
}
