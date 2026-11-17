"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useInboxEvents } from "@/components/chat/unread-chats";

/**
 * Keeps the chats list fresh: a new message in any of your chats, or a change to your own
 * membership, re-renders the list, batched so a busy group doesn't refresh on every message.
 * Listens through the shared inbox connection rather than opening its own.
 */
export function ChatsLive() {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  useInboxEvents(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => router.refresh(), 400);
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return null;
}
