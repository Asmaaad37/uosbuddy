import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UnblockButton } from "@/components/connect/unblock-button";
import { getSession } from "@/lib/auth/session";
import { Ban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Blocked" };

/** Settings → Blocked: who you've blocked, with unblock. */
export default async function BlockedPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/blocked");
  const { data: blocked } = await supabase.rpc("my_blocked");

  return (
    <AppShell>
      <ScreenHeader
        title="Blocked"
        back="/me"
        subtitle={
          <>
            You and these students can&apos;t see or message each other. Unblocking doesn&apos;t
            reconnect you.
          </>
        }
      />
      {blocked?.length ? (
        <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">
                  {b.full_name ?? b.handle ?? "Student"}
                </span>
                {b.handle && <span className="text-footnote text-sec">@{b.handle}</span>}
              </span>
              <UnblockButton target={b.id} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Ban}>You haven&apos;t blocked anyone.</EmptyState>
      )}
    </AppShell>
  );
}
