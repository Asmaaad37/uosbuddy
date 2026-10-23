"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/lazy";

/** Re-renders /pending when this user's verification changes (§3.3 B step 7, `user:{id}`). */
export function PendingLive({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    void browserClient().then((supabase) => {
      if (cancelled) return;
      channel = supabase
        .channel(`user:${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            const status = (payload.new as { verification_status?: string }).verification_status;
            if (status === "verified") window.location.assign("/auth/continue");
            else router.refresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "verification_requests",
            filter: `user_id=eq.${userId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void browserClient().then((supabase) => supabase.removeChannel(channel!));
    };
  }, [userId, router]);

  return null;
}
