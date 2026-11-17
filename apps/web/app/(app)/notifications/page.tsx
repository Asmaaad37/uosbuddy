import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  Bell,
  CalendarDays,
  Car,
  EyeOff,
  GraduationCap,
  LifeBuoy,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Users,
  VenetianMask,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarkAllRead } from "@/components/notifications/mark-read";
import { PushPrompt } from "@/components/notifications/push-prompt";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";
import { describe } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

/** One icon per kind of notification (the part of the type before the dot). */
const ICONS: Record<string, React.ElementType> = {
  connect: UserPlus,
  backup: LifeBuoy,
  post: MessageSquare,
  comment: MessageSquare,
  ping: Zap,
  mentor: GraduationCap,
  ride: Car,
  event: CalendarDays,
  society: Users,
  access: ShieldCheck,
  account: TriangleAlert,
  content: EyeOff,
  studies: GraduationCap,
  badge: Award,
  feature: Sparkles,
};

/** The notification centre (redesign §3: large title, grouped list). */
const PAGE = 60;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/notifications");
  // Older pages: ?before=<time of the last one shown>. Anything unparseable starts over.
  const raw = (await searchParams).before;
  const before = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
  const { data: items } = await supabase.rpc("my_notifications", {
    p_limit: PAGE,
    p_before: before,
  });
  const last = items?.at(-1);

  return (
    <AppShell>
      <MarkAllRead />
      <ScreenHeader
        title="Notifications"
        back="/explore"
        actions={
          <Link
            href="/me/notifications"
            aria-label="Notification settings"
            className="grid size-11 place-items-center rounded-pill bg-raised text-label active:scale-[0.97]"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        }
      />
      {(items?.length ?? 0) > 0 && (
        <PushPrompt reason="Get a ping on this phone when classmates need backup or message you." />
      )}
      {items?.length ? (
        <ul className="overflow-hidden rounded-card bg-surface shadow-card [&>li:last-child_[data-row-text]]:shadow-none">
          {items.map((n) => {
            const d = describe(n);
            const kind = n.type.split(".")[0]!;
            const Icon = ICONS[kind] ?? Bell;
            // No sender on a comment or reply means it was written anonymously.
            const anonymous = !n.actor_name && (kind === "post" || kind === "comment");
            return (
              <li key={n.id}>
                <Link
                  href={d.href}
                  className="flex items-center gap-3 pl-4 transition-colors active:bg-raised"
                >
                  <span className="relative shrink-0">
                    {n.actor_name ? (
                      <Avatar name={n.actor_name} src={n.actor_avatar} size="md" />
                    ) : (
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-pill",
                          anonymous ? "bg-fill text-on-fill" : "bg-tint text-accent",
                        )}
                      >
                        {anonymous ? (
                          <VenetianMask className="size-5" aria-hidden />
                        ) : (
                          <Icon className="size-5" aria-hidden />
                        )}
                      </span>
                    )}
                    {n.actor_name && (
                      <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-pill border-2 border-surface bg-raised text-sec">
                        <Icon className="size-3" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span
                    data-row-text
                    className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 shadow-[inset_0_-1px_0_var(--sep)]"
                  >
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span
                        className={cn("text-subhead text-label", !n.read_at && "font-semibold")}
                      >
                        {d.title}
                      </span>
                      {d.body && <span className="truncate text-footnote text-sec">{d.body}</span>}
                      <span className="text-footnote text-ter">{shortTime(n.created_at)}</span>
                    </span>
                    {!n.read_at && (
                      <span
                        aria-label="Unread"
                        className="size-2.5 shrink-0 rounded-pill bg-accent"
                      />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : before ? (
        <EmptyState icon={Bell} title="That's everything">
          Notifications are kept for 90 days.
        </EmptyState>
      ) : (
        <EmptyState icon={Bell} title="Nothing yet">
          Connect requests, Backup pings and comments show up here.
        </EmptyState>
      )}
      {(items?.length ?? 0) === PAGE && last && (
        <Link
          href={`/notifications?before=${encodeURIComponent(last.created_at)}`}
          className="justify-self-center text-subhead font-semibold text-accent"
        >
          Show older
        </Link>
      )}
      {before && (
        <Link href="/notifications" className="justify-self-center text-subhead text-sec">
          Back to the newest
        </Link>
      )}
    </AppShell>
  );
}
