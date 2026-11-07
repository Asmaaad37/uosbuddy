import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  GraduationCap,
  LifeBuoy,
  MessageSquare,
  Settings,
  UserPlus,
  VenetianMask,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarkAllRead } from "@/components/notifications/mark-read";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { Avatar } from "@/components/ui/avatar";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";
import { describe } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  connect: UserPlus,
  backup: LifeBuoy,
  post: MessageSquare,
  comment: MessageSquare,
  ping: Zap,
  mentor: GraduationCap,
};

/** Phase 5 task 5: the notification centre. */
export default async function NotificationsPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/notifications");
  const { data: items } = await supabase.rpc("my_notifications", { p_limit: 60 });

  return (
    <AppShell
      back="/explore"
      action={
        <Link
          href="/me/notifications"
          aria-label="Notification settings"
          className="grid size-11 place-items-center rounded-pill hover:bg-raised"
        >
          <Settings className="size-5" />
        </Link>
      }
    >
      <MarkAllRead />
      <h1 className="text-large-title">Notifications</h1>
      {(items?.length ?? 0) > 0 && (
        <PushPrompt reason="Get a ping on this phone when classmates need backup or message you." />
      )}
      {items?.length ? (
        <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface">
          {items.map((n) => {
            const d = describe(n);
            const Icon = ICONS[n.type.split(".")[0]!] ?? Bell;
            return (
              <li key={n.id}>
                <Link
                  href={d.href}
                  className={cn("flex gap-3 px-4 py-3 hover:bg-raised", !n.read_at && "bg-tint")}
                >
                  <span className="relative shrink-0">
                    {n.actor_name ? (
                      <Avatar name={n.actor_name} src={n.actor_avatar} size="md" />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-pill bg-fill text-on-fill">
                        <VenetianMask className="size-5" />
                      </span>
                    )}
                    <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-pill border-2 border-surface bg-fill text-on-fill">
                      <Icon className="size-3" />
                    </span>
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className={cn("text-[15px]", !n.read_at && "font-semibold")}>
                      {d.title}
                    </span>
                    {d.body && <span className="truncate text-sm text-sec">{d.body}</span>}
                    <span className="text-xs text-sec">{shortTime(n.created_at)}</span>
                  </span>
                  {!n.read_at && (
                    <span
                      aria-label="Unread"
                      className="mt-2 size-2 shrink-0 rounded-pill bg-fill"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Bell}>
          Nothing yet. Connect requests, Backup pings and comments show up here.
        </EmptyState>
      )}
    </AppShell>
  );
}
