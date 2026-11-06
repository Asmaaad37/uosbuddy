import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

type Kpis = {
  daily: { day: string; signups: number; verified: number; active: number }[];
  funnel: {
    signed_up: number;
    submitted: number;
    verified: number;
    onboarded: number;
    pending: number;
  };
  dau: number;
  wau: number;
  mau: number;
  cohorts: { week: string; size: number; w1: number; w2: number; w4: number }[];
  top_departments: { short_code: string; name: string; students: number }[];
  open_reports: number;
  held_posts: number;
};

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <span className="text-sm text-sec">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="grid gap-1 rounded-card border border-sep bg-surface p-4 hover:border-sec/50"
    >
      {body}
    </Link>
  ) : (
    <div className="grid gap-1 rounded-card border border-sep bg-surface p-4">{body}</div>
  );
}

/** Phase 9 task 1: KPIs at a glance, and the latest audited actions. */
export default async function AdminDashboard() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const [{ data }, { data: audit }] = await Promise.all([
    supabase.rpc("admin_kpis"),
    supabase
      .from("audit_log")
      .select(
        "id, created_at, action, target_type, actor:profiles!audit_log_actor_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  const k = data as unknown as Kpis;
  const max = Math.max(1, ...k.daily.map((d) => Math.max(d.signups, d.active)));
  const f = k.funnel;
  const steps = [
    ["Signed up", f.signed_up],
    ["Sent proof", f.submitted],
    ["Verified", f.verified],
    ["Set up profile", f.onboarded],
  ] as const;

  return (
    <AdminShell current="/admin" isAdmin back={homePath(profile)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active today" value={k.dau} />
        <Stat label="Active this week" value={k.wau} />
        <Stat label="Open reports" value={k.open_reports} href="/admin/reports" />
        <Stat label="Waiting for verification" value={f.pending} href="/admin/verifications" />
      </div>

      <section
        aria-labelledby="daily"
        className="grid gap-2 rounded-card border border-sep bg-surface p-4"
      >
        <h2 id="daily" className="font-bold">
          Last 30 days
        </h2>
        <div
          className="flex h-32 items-end gap-0.5"
          role="img"
          aria-label={`Sign-ups and active students per day; ${k.mau} active in the last 30 days`}
        >
          {k.daily.map((d) => (
            <div
              key={d.day}
              className="flex h-full flex-1 items-end gap-px"
              title={`${d.day}: ${d.signups} sign-ups, ${d.active} active`}
            >
              <div
                className="flex-1 rounded-t-track bg-fill"
                style={{ height: `${(d.signups / max) * 100}%` }}
              />
              <div
                className="flex-1 rounded-t-track bg-raised"
                style={{ height: `${(d.active / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <p className="flex gap-4 text-xs text-sec">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-track bg-fill" /> Sign-ups
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-track bg-raised" /> Active
          </span>
          <span>{k.mau} active in 30 days</span>
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="funnel"
          className="grid gap-2 rounded-card border border-sep bg-surface p-4"
        >
          <h2 id="funnel" className="font-bold">
            Verification funnel
          </h2>
          {steps.map(([label, n]) => (
            <div key={label} className="grid gap-1">
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums">
                  {n}
                  {f.signed_up > 0 && ` · ${Math.round((n / f.signed_up) * 100)}%`}
                </span>
              </div>
              <div className="h-2 rounded-pill bg-raised">
                <div
                  className="h-2 rounded-pill bg-fill"
                  style={{ width: `${f.signed_up ? (n / f.signed_up) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section
          aria-labelledby="depts"
          className="grid gap-2 rounded-card border border-sep bg-surface p-4"
        >
          <h2 id="depts" className="font-bold">
            Top departments
          </h2>
          <ol className="grid gap-1.5 text-sm">
            {k.top_departments.map((d) => (
              <li key={d.short_code} className="flex justify-between gap-2">
                <span className="truncate">{d.name}</span>
                <span className="tabular-nums">{d.students}</span>
              </li>
            ))}
            {!k.top_departments.length && <li className="text-sec">No verified students yet.</li>}
          </ol>
        </section>
      </div>

      <section
        aria-labelledby="retention"
        className="grid gap-2 rounded-card border border-sep bg-surface p-4"
      >
        <h2 id="retention" className="font-bold">
          Retention by week verified
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-sec">
              <tr>
                <th className="py-1 font-medium">Week of</th>
                <th className="py-1 font-medium">Students</th>
                <th className="py-1 font-medium">Week 1</th>
                <th className="py-1 font-medium">Week 2</th>
                <th className="py-1 font-medium">Week 4</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {k.cohorts.map((c) => (
                <tr key={c.week} className="border-t border-sep">
                  <td className="py-1.5">{c.week}</td>
                  <td>{c.size}</td>
                  <td>{c.w1}%</td>
                  <td>{c.w2}%</td>
                  <td>{c.w4}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!k.cohorts.length && <p className="text-sm text-sec">No cohorts yet.</p>}
        </div>
      </section>

      <section aria-labelledby="audit" className="grid gap-2">
        <h2 id="audit" className="font-bold">
          Recent admin and moderator actions
        </h2>
        <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface text-sm">
          {(audit ?? []).map((a) => (
            <li key={a.id} className="flex gap-3 px-3 py-2">
              <span className="w-16 shrink-0 text-sec">{shortTime(a.created_at)}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{a.actor?.full_name ?? "System"}</span> · {a.action}{" "}
                · {a.target_type}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
