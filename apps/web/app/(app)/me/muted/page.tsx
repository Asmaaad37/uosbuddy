import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VolumeX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { UnmuteButton } from "@/components/feed/unmute-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth/session";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Muted" };

/** Me → Muted: students whose posts you've muted, with unmute. They're never told. */
export default async function MutedPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/muted");
  const { data: muted } = await supabase.rpc("my_mutes");

  return (
    <AppShell>
      <ScreenHeader
        title="Muted"
        back="/me"
        subtitle={
          <>
            Their posts don&apos;t show in your feeds. They aren&apos;t told, and you can still chat
            or visit their profile.
          </>
        }
      />
      {muted?.length ? (
        <ul className="overflow-hidden rounded-card bg-surface shadow-card [&>li:last-child>div]:shadow-none">
          {muted.map((m) => {
            const name = m.full_name ?? m.handle ?? "Student";
            return (
              <li key={m.user_id} className="flex items-center gap-3 pl-4">
                <Avatar name={name} src={m.avatar_url} size={40} />
                <div className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 pr-4 shadow-[inset_0_-1px_0_var(--sep)]">
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate text-body">{name}</span>
                    {m.handle && <span className="text-footnote text-ter">@{m.handle}</span>}
                  </span>
                  <UnmuteButton target={m.user_id} name={name} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={VolumeX} title="Nobody muted">
          Mute someone from the ⋯ menu on their post to stop seeing their posts.
        </EmptyState>
      )}
    </AppShell>
  );
}
