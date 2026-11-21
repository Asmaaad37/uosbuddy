"use client";

import { useEffect, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { loadFeed, type FeedPage, type Sort } from "@/actions/feed";
import { openComposer } from "@/components/feed/composer";
import { MUTE_EVENT, PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** The posts of one feed, with "Load more" (keyset pages of 20). */
export function FeedList({
  space,
  sort,
  initial,
  mediaUrls,
  failed = false,
}: {
  failed?: boolean;
  space: string;
  sort: Sort;
  initial: FeedPage;
  mediaUrls: Record<string, string>;
}) {
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [muted, setMuted] = useState<Set<string>>(new Set());

  // A post card muted (or unmuted) its author: drop (or bring back) their named posts.
  useEffect(() => {
    const on = (e: Event) => {
      const { author, on: muting } = (e as CustomEvent<{ author: string; on: boolean }>).detail;
      setMuted((prev) => {
        const next = new Set(prev);
        if (muting) next.add(author);
        else next.delete(author);
        return next;
      });
    };
    window.addEventListener(MUTE_EVENT, on);
    return () => window.removeEventListener(MUTE_EVENT, on);
  }, []);

  async function more() {
    if (!page.next) return;
    setBusy(true);
    const result = await loadFeed({ space, sort, after: page.next });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPage((p) => ({ posts: [...p.posts, ...result.data.posts], next: result.data.next }));
  }

  if (failed) return null;
  if (page.posts.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No posts yet"
        mascot="idle"
        action={
          <Button variant="tinted" size="sm" onClick={openComposer}>
            Start the first post
          </Button>
        }
      >
        Be the first to post here.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {page.posts
          .filter((p) => p.is_anonymous || !p.author_id || !muted.has(p.author_id))
          .map((p) => (
            <li
              key={p.id}
              className="[contain-intrinsic-size:auto_240px] [content-visibility:auto]"
            >
              <PostCard post={p} mediaUrls={mediaUrls} />
            </li>
          ))}
      </ul>
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
      {page.next ? (
        <Button variant="tinted" block onClick={more} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {busy ? "Loading…" : "Load more"}
        </Button>
      ) : (
        <p className="flex items-center gap-4 px-8 py-3 text-subhead text-ter">
          <span aria-hidden className="h-px flex-1 bg-sep" />
          You&apos;re all caught up
          <span aria-hidden className="h-px flex-1 bg-sep" />
        </p>
      )}
    </div>
  );
}
