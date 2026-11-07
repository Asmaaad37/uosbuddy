"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { ChatRow, type ChatRowData } from "@/components/chat/chat-row";
import { SearchField } from "@/components/ui/input";

/**
 * Chats search and list (redesign §5.4): the search field filters this folder's chats by
 * name or last message, and offers the people directory for the same words. `folders` (the
 * segmented control) sits between the field and the list; `empty` shows when the folder
 * has no chats at all.
 */
export function ChatsBrowser({
  chats,
  folders,
  before,
  empty,
}: {
  chats: ChatRowData[];
  folders: React.ReactNode;
  /** Rows shown above the chats (requests, suggested batch chats). */
  before?: React.ReactNode;
  empty: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? chats.filter((c) => c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
    : chats;

  return (
    <>
      <SearchField
        placeholder="Search people and chats"
        aria-label="Search people and chats"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {folders}
      {!q && before}
      {shown.length > 0 && (
        <ul
          aria-label="Chats"
          className="overflow-hidden rounded-card bg-surface shadow-card [&>li:last-child_[data-row-text]]:shadow-none"
        >
          {shown.map((c) => (
            <ChatRow key={c.id} chat={c} />
          ))}
        </ul>
      )}
      {q ? (
        <Link
          href={`/explore/batch?tab=all&q=${encodeURIComponent(query.trim())}`}
          className="flex min-h-[52px] items-center gap-3 rounded-card bg-surface px-4 active:bg-raised"
        >
          <Search className="size-[22px] text-sec" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-body">
            Find people named &ldquo;{query.trim()}&rdquo;
          </span>
          <ChevronRight className="size-[18px] text-ter" aria-hidden />
        </Link>
      ) : (
        chats.length === 0 && empty
      )}
    </>
  );
}
