import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampusDecision } from "@/components/admin/campus-actions";
import { Avatar } from "@/components/ui/avatar";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Campus queues", robots: { index: false } };

/** Phase 8: women-only access requests and societies waiting for a check. */
export default async function CampusAdminPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();

  const [{ data: women }, { data: societies }] = await Promise.all([
    supabase.rpc("women_only_queue"),
    supabase.rpc("societies_list"),
  ]);
  const waiting = (societies ?? []).filter((s) => !s.verified);

  return (
    <div className="min-h-dvh">
      <header className="gutter flex items-center justify-between border-b border-line py-3">
        <span className="font-pixel text-lg">UOSBUDDY ADMIN</span>
        <nav className="flex gap-4 text-sm font-semibold text-brand">
          <Link href="/admin/verifications">Verifications</Link>
          <Link href={homePath(profile)}>Back to app</Link>
        </nav>
      </header>
      <main className="gutter mx-auto grid max-w-3xl gap-8 py-6">
        <section aria-labelledby="women" className="grid gap-3">
          <div>
            <h1 id="women" className="text-[24px] font-bold">
              Women-only access
            </h1>
            <p className="text-sm text-ink-2">
              Approve only students you&apos;re confident are women (check their verification
              details if unsure). Approved students can see and join women-only rides.
            </p>
          </div>
          {women?.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {women.map((w) => (
                <li key={w.user_id} className="flex flex-wrap items-center gap-3 p-3">
                  <Avatar name={w.full_name} src={w.avatar_url} size="md" />
                  <div className="grid min-w-0 flex-1">
                    <Link href={`/people/${w.handle}`} className="font-semibold">
                      {w.full_name}
                    </Link>
                    <span className="text-xs text-ink-2">
                      {[w.department, w.batch_year].filter(Boolean).join(" · ")}
                    </span>
                    {w.note && <span className="text-sm">“{w.note}”</span>}
                  </div>
                  <CampusDecision kind="women-only" target={w.user_id} name={w.full_name} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-2">
              No requests waiting.
            </p>
          )}
        </section>

        <section aria-labelledby="societies" className="grid gap-3">
          <div>
            <h2 id="societies" className="text-[24px] font-bold">
              Societies to verify
            </h2>
            <p className="text-sm text-ink-2">
              Verify only registered UoS societies. Their admins can then post events.
            </p>
          </div>
          {waiting.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {waiting.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="grid min-w-0 flex-1">
                    <Link href={`/events/s/${s.slug}`} className="font-semibold">
                      {s.emoji} {s.name}
                    </Link>
                    {s.description && (
                      <span className="line-clamp-2 text-sm text-ink-2">{s.description}</span>
                    )}
                  </div>
                  <CampusDecision kind="society" target={s.id} name={s.name} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-2">
              No societies waiting.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
