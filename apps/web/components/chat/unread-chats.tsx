"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";

const UnreadContext = createContext(0);
type InboxListener = () => void;
const InboxContext = createContext<Set<InboxListener> | null>(null);

/** Unread chat messages for the Chats tab and sidebar row (muted chats left out). */
export const useUnreadChats = () => useContext(UnreadContext);

/**
 * Run `onChange` when something changes in your chats: a new message in any of them, or
 * your own membership (joined, left, muted, read). Shares the one inbox connection.
 */
export function useInboxEvents(onChange: InboxListener) {
  const listeners = useContext(InboxContext);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    if (!listeners) return;
    const call = () => latest.current();
    listeners.add(call);
    return () => {
      listeners.delete(call);
    };
  }, [listeners]);
}

/**
 * Keeps the Chats badge live: counts on load and on every navigation (opening a chat reads
 * it), and recounts shortly after a new message in one of your chats or a change to your own
 * chat settings. New messages arrive on your private inbox channel (C18): the database
 * signals each member, so Realtime never checks every message against every listener.
 */
export function UnreadChatsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  const [listeners] = useState(() => new Set<InboxListener>());
  const path = usePathname();
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
      const again = () => {
        recount.current();
        for (const listener of listeners) listener();
      };
      channel = supabase
        .channel(`inbox:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "message" }, again)
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
  }, [userId, listeners]);

  return (
    <InboxContext.Provider value={listeners}>
      <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>
    </InboxContext.Provider>
  );
}

/** The badge: an --accent pill with the count (99+ above that). */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={
        "grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-kinnow px-1 text-caption leading-none font-bold text-on-kinnow tabular-nums " +
        (className ?? "")
      }
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
