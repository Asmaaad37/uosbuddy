import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UnblockButton } from "@/components/connect/unblock-button";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Blocked" };

/** Settings → Blocked: who you've blocked, with unblock. */
export default async function BlockedPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/blocked");
  const { data: blocked } = await supabase.rpc("my_blocked");

  return (
    <AppShell back="/me">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">Blocked</h1>
        <p className="text-ink-2">
          You and these students can&apos;t see or message each other. Unblocking doesn&apos;t
          reconnect you.
        </p>
      </div>
      {blocked?.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">
                  {b.full_name ?? b.handle ?? "Student"}
                </span>
                {b.handle && <span className="text-[13px] text-ink-2">@{b.handle}</span>}
              </span>
              <UnblockButton target={b.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
          You haven&apos;t blocked anyone.
        </p>
      )}
    </AppShell>
  );
}
