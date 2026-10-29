"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

/** Re-renders /pending when this user's verification changes (§3.3 B step 7, `user:{id}`). */
export function PendingLive({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    void realtimeClient().then((supabase) => {
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

    // Safety net for dropped realtime connections (flaky mobile data): re-check every 20 s.
    // The page redirects on its own once the status is no longer under review.
    const poll = window.setInterval(() => router.refresh(), 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (channel) void browserClient().then((supabase) => supabase.removeChannel(channel!));
    };
  }, [userId, router]);

  return null;
}
