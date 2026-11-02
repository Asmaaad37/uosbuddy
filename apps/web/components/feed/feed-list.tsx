"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { loadFeed, type FeedPage, type Sort } from "@/actions/feed";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";

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
      <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
        Nothing here yet. Be the first to post!
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {page.posts.map((p) => (
          <li key={p.id} className="[contain-intrinsic-size:auto_240px] [content-visibility:auto]">
            <PostCard post={p} mediaUrls={mediaUrls} />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {page.next && (
        <Button variant="secondary" block onClick={more} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {busy ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
