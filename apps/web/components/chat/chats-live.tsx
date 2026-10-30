"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

/**
 * Keeps the chats list fresh: any new message in a chat you're in (RLS decides which)
 * re-renders the list, batched so a busy group doesn't refresh on every message.
 */
export function ChatsLive({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 400);
    };

    void realtimeClient().then((supabase) => {
      if (cancelled) return;
      channel = supabase
        .channel(`chats:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_members",
            filter: `user_id=eq.${userId}`,
          },
          refresh,
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) void browserClient().then((supabase) => supabase.removeChannel(channel!));
    };
  }, [userId, router]);

  return null;
}
