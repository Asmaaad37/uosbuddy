"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

const UnreadContext = createContext(0);

/** Unread chat messages for the Chats tab and sidebar row (muted chats left out). */
export const useUnreadChats = () => useContext(UnreadContext);

/**
 * Keeps the Chats badge live: counts on load and on every navigation (opening a chat reads
 * it), and recounts shortly after any new message in a chat you're in or a change to your
 * own chat settings (realtime; RLS decides which messages reach you).
 */
export function UnreadChatsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const path = usePathname();
  const instance = useId();
  const timer = useRef<number | undefined>(undefined);

  const recount = useRef(() => {});
  recount.current = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const supabase = await browserClient();
      const { data, error } = await supabase.rpc("unread_chat_count");
      if (!error) setCount(data ?? 0);
    }, 300);
  };

  // On load and whenever you move between screens (e.g. after reading a chat).
  useEffect(() => {
    if (userId) recount.current();
  }, [userId, path]);

  useEffect(() => {
    if (!userId) return;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;
    void realtimeClient().then((supabase) => {
      if (cancelled) return;
      const again = () => recount.current();
      channel = supabase
        .channel(`unread:${userId}:${instance}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, again)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_members",
            filter: `user_id=eq.${userId}`,
          },
          again,
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      if (channel) void browserClient().then((s) => s.removeChannel(channel!));
    };
  }, [userId, instance]);

  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}

/** The badge: an --accent pill with the count (99+ above that). */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={
        "grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-fill px-1 text-caption leading-none font-semibold text-on-fill tabular-nums " +
        (className ?? "")
      }
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
