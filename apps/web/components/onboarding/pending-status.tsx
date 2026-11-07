"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

/** Re-renders /pending when this user's verification changes (§3.3 B step 7, `user:{id}`). */
export function PendingLive({ userId }: { userId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

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
        // "SUBSCRIBED" only means the channel joined. Row changes flow once the server says
        // "Subscribed to PostgreSQL" (a system message), which on a cold server can come
        // seconds later; anything decided before then is missed, so look once at that point.
        .on("system", {}, (payload: { extension?: string; status?: string }) => {
          if (payload.extension !== "postgres_changes") return;
          const ready = payload.status === "ok";
          setLive(ready);
          if (ready) router.refresh();
        })
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") setLive(false);
        });
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

  if (!live) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-sec">
      <span className="size-2 animate-pulse rounded-pill bg-fill" aria-hidden />
      Live: this page updates by itself when there&apos;s news.
    </p>
  );
}
