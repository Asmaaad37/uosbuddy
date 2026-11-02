"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigDown,
  ArrowBigUp,
  Flag,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  VenetianMask,
} from "lucide-react";
import { deletePost, votePoll, votePost, type Post } from "@/actions/feed";
import { ReportDialog } from "@/components/connect/safety-menu";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PrivateImage } from "@/components/ui/private-image";
import { shortTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

/** Phase 5 task 2: one post. Votes and poll answers update optimistically. */
export function PostCard({
  post: initial,
  mediaUrls = {},
  linkToThread = true,
}: {
  post: Post;
  mediaUrls?: Record<string, string>;
  linkToThread?: boolean;
}) {
  const [post, setPost] = useState(initial);
  const [removed, setRemoved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string>();
  if (removed || !post.id) return null;
  const id = post.id;

  async function vote(dir: 1 | -1) {
    const old = post.my_vote ?? 0;
    const next = old === dir ? 0 : dir;
    const up = (post.upvotes ?? 0) - (old === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
    const down = (post.downvotes ?? 0) - (old === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
    setPost((p) => ({ ...p, my_vote: next || null, upvotes: up, downvotes: down }));
    const result = await votePost(id, next as -1 | 0 | 1);
    if (!result.ok) {
      setError(result.error);
      setPost((p) => ({
        ...p,
        my_vote: old || null,
        upvotes: initial.upvotes,
        downvotes: initial.downvotes,
      }));
    }
  }

  async function answer(option: number) {
    if (!post.poll_counts) return;
    const old = post.my_poll_option;
    const counts = [...post.poll_counts];
    if (old !== null && old !== undefined) counts[old] = Math.max(0, (counts[old] ?? 1) - 1);
    counts[option] = (counts[option] ?? 0) + 1;
    setPost((p) => ({ ...p, my_poll_option: option, poll_counts: counts }));
    const result = await votePoll(id, option);
    if (!result.ok) setError(result.error);
  }

  const name = post.author_name ?? "Student";
  const score = (post.upvotes ?? 0) - (post.downvotes ?? 0);
  const options = ((post.poll as { options?: string[] } | null)?.options ?? []) as string[];
  const totalVotes = (post.poll_counts ?? []).reduce((a, b) => a + b, 0);
  const media = post.media_paths ?? [];

  return (
    <article className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex items-center gap-3">
        {post.is_anonymous ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-ink text-bg">
            <VenetianMask className="size-5" />
          </span>
        ) : (
          <Link href={`/people/${post.author_handle}`}>
            <Avatar name={name} src={post.author_avatar} size="md" />
          </Link>
        )}
        <div className="grid min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {post.is_anonymous ? (
              <span className="truncate font-semibold">{name}</span>
            ) : (
              <Link
                href={`/people/${post.author_handle}`}
                className="truncate font-semibold hover:underline"
              >
                {name}
              </Link>
            )}
            {post.is_anonymous && (
              <Chip tone="neutral" className="h-5 px-2 text-[11px]">
                Anonymous
              </Chip>
            )}
            {post.status === "held" && (
              <Chip tone="outline" className="h-5 px-2 text-[11px]">
                Under review
              </Chip>
            )}
          </div>
          {post.created_at && (
            <span className="text-xs text-ink-2">{shortTime(post.created_at)}</span>
          )}
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Post options"
              className="grid size-9 place-items-center rounded-pill text-ink-2 hover:bg-surface-2"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            {post.is_mine ? (
              <MenuItem
                danger
                onSelect={async () => {
                  const r = await deletePost(id);
                  if (r.ok) setRemoved(true);
                  else setError(r.error);
                }}
              >
                <Trash2 /> Delete post
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => setReporting(true)}>
                <Flag /> Report post
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </header>

      {post.body && <p className="leading-relaxed break-words whitespace-pre-wrap">{post.body}</p>}

      {media.length > 0 && (
        <div
          className={cn("grid gap-1 overflow-hidden rounded-md", media.length > 1 && "grid-cols-2")}
        >
          {media.map((path) => (
            <PrivateImage
              key={path}
              bucket="post-media"
              path={path}
              seed={mediaUrls[path]}
              alt="Photo in post"
              className={cn("w-full", media.length === 1 ? "max-h-96" : "aspect-square")}
            />
          ))}
        </div>
      )}

      {options.length > 0 && (
        <div className="grid gap-2" role="group" aria-label="Poll">
          {options.map((label, i) => {
            const count = post.poll_counts?.[i] ?? 0;
            const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const answered = post.my_poll_option !== null && post.my_poll_option !== undefined;
            const mine = post.my_poll_option === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => answer(i)}
                aria-pressed={mine}
                className={cn(
                  "relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm font-medium",
                  mine ? "border-brand" : "border-line hover:border-ink-2/50",
                )}
              >
                {answered && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0",
                      mine ? "bg-brand/15" : "bg-surface-2",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex justify-between gap-2">
                  <span>{label}</span>
                  {answered && <span className="text-ink-2">{pct}%</span>}
                </span>
              </button>
            );
          })}
          <p className="text-xs text-ink-2">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </p>
        </div>
      )}

      <footer className="flex items-center gap-1">
        <div className="flex items-center rounded-pill bg-surface-2">
          <button
            type="button"
            aria-label="Upvote"
            aria-pressed={post.my_vote === 1}
            onClick={() => vote(1)}
            className={cn(
              "grid size-9 place-items-center rounded-pill",
              post.my_vote === 1 ? "text-brand" : "text-ink-2 hover:text-ink",
            )}
          >
            <ArrowBigUp className={cn("size-5", post.my_vote === 1 && "fill-current")} />
          </button>
          <span className="min-w-6 text-center text-sm font-semibold" aria-label={`Score ${score}`}>
            {score}
          </span>
          <button
            type="button"
            aria-label="Downvote"
            aria-pressed={post.my_vote === -1}
            onClick={() => vote(-1)}
            className={cn(
              "grid size-9 place-items-center rounded-pill",
              post.my_vote === -1 ? "text-danger" : "text-ink-2 hover:text-ink",
            )}
          >
            <ArrowBigDown className={cn("size-5", post.my_vote === -1 && "fill-current")} />
          </button>
        </div>
        {linkToThread ? (
          <Link
            href={`/feed/${id}`}
            className="flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <MessageSquare className="size-4" /> {post.comment_count ?? 0}
            <span className="sr-only">comments</span>
          </Link>
        ) : (
          <span className="flex h-9 items-center gap-1.5 px-3 text-sm font-semibold text-ink-2">
            <MessageSquare className="size-4" /> {post.comment_count ?? 0}
          </span>
        )}
      </footer>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        title="Report post"
        targetType="post"
        targetId={id}
      />
    </article>
  );
}
