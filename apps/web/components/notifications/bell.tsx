"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell } from "lucide-react";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

/** Phase 5 task 5: the bell, with a live unread count (`user:{id}` realtime). */
export function NotificationBell({
  userId,
  initialUnread,
}: {
  userId: string;
  initialUnread: number;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const path = usePathname();

  // Opening the notification centre clears the badge.
  useEffect(() => {
    if (path === "/notifications") setUnread(0);
  }, [path]);

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    void realtimeClient().then((supabase) => {
      if (cancelled) return;
      channel = supabase
        .channel(`user:${userId}:notifications`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => setUnread((n) => n + 1),
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void browserClient().then((s) => s.removeChannel(channel!));
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative grid size-11 shrink-0 place-items-center rounded-pill bg-surface text-label transition-transform duration-100 ease-out hover:bg-raised active:scale-[0.97]"
    >
      <Bell className="size-[22px]" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-fill px-1 text-[11px] font-semibold text-on-fill ring-2 ring-bg">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
