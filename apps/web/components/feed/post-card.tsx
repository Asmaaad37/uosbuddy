"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Flag,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Share,
  Trash2,
  VenetianMask,
} from "lucide-react";
import { toast } from "sonner";
import { deletePost, votePoll, votePost, type Post } from "@/actions/feed";
import { ReportDialog } from "@/components/connect/safety-menu";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PrivateImage } from "@/components/ui/private-image";
import { VerifiedBadge } from "@/components/ui/verified-badge";
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
  const [bump, setBump] = useState<{ n: number; dir: number }>({ n: 0, dir: 1 });
  if (removed || !post.id) return null;
  const id = post.id;

  async function vote(dir: 1 | -1) {
    const old = post.my_vote ?? 0;
    const next = old === dir ? 0 : dir;
    // Spec §6: the icon pops, the score rolls the way it moved, and a light haptic fires.
    setBump((b) => ({ n: b.n + 1, dir: next === 0 ? -dir : dir }));
    navigator.vibrate?.(8);
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

  const meta = [
    post.author_department_code,
    post.author_batch_year,
    post.created_at && shortTime(post.created_at),
  ]
    .filter(Boolean)
    .join(" · ");
  const link = () => new URL(`/feed/${id}`, window.location.origin).toString();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link());
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function share() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "UOSBuddy", url: link() });
    } catch {
      // Closing the share sheet throws; nothing to do.
    }
  }

  // 44px hit area; the active vote gets a --tint circle and the --accent colour.
  const voteClass = (on: boolean) =>
    cn(
      "grid size-11 place-items-center rounded-pill transition-transform duration-100 ease-out active:scale-[0.97] [&_svg]:size-[22px]",
      on ? "text-accent [&>span]:bg-tint" : "text-sec hover:text-label",
    );

  return (
    <article className="grid gap-3 rounded-card bg-surface p-4 shadow-card contrast-more:border contrast-more:border-label">
      <header className="flex items-center gap-3">
        {post.is_anonymous ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-raised text-sec">
            <VenetianMask className="size-5" aria-hidden />
          </span>
        ) : (
          <Link href={`/people/${post.author_handle}`} tabIndex={-1} aria-hidden>
            <Avatar name={name} src={post.author_avatar} size={40} />
          </Link>
        )}
        <div className="grid min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {post.is_anonymous ? (
              <span className="truncate text-subhead font-semibold">{name}</span>
            ) : (
              <>
                <Link
                  href={`/people/${post.author_handle}`}
                  className="truncate text-subhead font-semibold"
                >
                  {name}
                </Link>
                <VerifiedBadge className="size-4 shrink-0" />
              </>
            )}
            {post.is_anonymous && (
              <Pill tone="neutral" className="h-5 px-2 text-[11px]">
                Anonymous
              </Pill>
            )}
            {post.status === "held" && (
              <Pill tone="outline" className="h-5 px-2 text-[11px]">
                Under review
              </Pill>
            )}
          </div>
          {meta && <span className="truncate text-footnote text-ter">{meta}</span>}
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="Post options"
              className="-mr-2 grid size-11 place-items-center rounded-pill text-sec active:bg-raised"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={copyLink}>
              <LinkIcon /> Copy link
            </MenuItem>
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

      {post.body && <p className="text-body break-words whitespace-pre-wrap">{post.body}</p>}

      {media.length > 0 && (
        <div
          className={cn(
            "grid gap-1 overflow-hidden rounded-well",
            media.length > 1 && "grid-cols-2",
          )}
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
                  "relative min-h-11 overflow-hidden rounded-field border px-3 py-2 text-left text-subhead",
                  mine ? "border-accent" : "border-sep",
                )}
              >
                {answered && (
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0", mine ? "bg-tint" : "bg-raised")}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative flex justify-between gap-2">
                  <span className={cn(mine && "font-semibold text-tint-text")}>{label}</span>
                  {answered && <span className="text-sec">{pct}%</span>}
                </span>
              </button>
            );
          })}
          <p className="text-footnote text-ter">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </p>
        </div>
      )}

      <footer className="-mx-2 -mb-1 flex items-center">
        <button
          type="button"
          aria-label="Upvote"
          aria-pressed={post.my_vote === 1}
          onClick={() => vote(1)}
          className={voteClass(post.my_vote === 1)}
        >
          <span
            key={post.my_vote === 1 ? bump.n : "up"}
            className={cn(
              "grid size-9 place-items-center rounded-pill",
              post.my_vote === 1 && bump.n > 0 && "vote-pop",
            )}
          >
            <ArrowUp strokeWidth={post.my_vote === 1 ? 2.4 : 1.9} />
          </span>
        </button>
        <span
          className={cn(
            "min-w-6 overflow-hidden text-center text-subhead font-semibold tabular-nums",
            post.my_vote ? "text-accent" : "text-label",
          )}
          aria-label={`Score ${score}`}
        >
          <span
            key={bump.n}
            className={cn("block", bump.n > 0 && (bump.dir > 0 ? "roll-up" : "roll-down"))}
          >
            {score}
          </span>
        </span>
        <button
          type="button"
          aria-label="Downvote"
          aria-pressed={post.my_vote === -1}
          onClick={() => vote(-1)}
          className={voteClass(post.my_vote === -1)}
        >
          <span
            key={post.my_vote === -1 ? bump.n : "down"}
            className={cn(
              "grid size-9 place-items-center rounded-pill",
              post.my_vote === -1 && bump.n > 0 && "vote-pop",
            )}
          >
            <ArrowDown strokeWidth={post.my_vote === -1 ? 2.4 : 1.9} />
          </span>
        </button>
        {linkToThread ? (
          <Link
            href={`/feed/${id}`}
            className="ml-4 flex h-11 items-center gap-1.5 rounded-pill px-2 text-subhead text-sec active:bg-raised"
          >
            <MessageCircle className="size-[22px]" strokeWidth={1.9} aria-hidden />
            {post.comment_count ?? 0}
            <span className="sr-only">comments</span>
          </Link>
        ) : (
          <span className="ml-4 flex h-11 items-center gap-1.5 px-2 text-subhead text-sec">
            <MessageCircle className="size-[22px]" strokeWidth={1.9} aria-hidden />
            {post.comment_count ?? 0}
            <span className="sr-only">comments</span>
          </span>
        )}
        <button
          type="button"
          aria-label="Share post"
          onClick={share}
          className="ml-auto grid size-11 place-items-center rounded-pill text-sec active:bg-raised"
        >
          <Share className="size-[22px]" strokeWidth={1.9} aria-hidden />
        </button>
      </footer>

      {error && (
        <p role="alert" className="text-subhead text-danger">
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
