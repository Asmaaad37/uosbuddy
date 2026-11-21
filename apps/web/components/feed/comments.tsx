"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flag, Loader2, MoreHorizontal, Trash2, VenetianMask } from "lucide-react";
import { createComment, deleteComment, type Comment } from "@/actions/feed";
import { SupportDialog } from "@/components/safety/support-dialog";
import { mentionsSelfHarm } from "@/lib/support";
import { toast } from "@/components/ui/toast";
import { useGuidelinesGate } from "@/components/trust/guidelines-gate";
import { GUIDELINES_REQUIRED } from "@/lib/guidelines";
import { ReportDialog } from "@/components/connect/safety-menu";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { shortTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

/** Phase 5 task 2: a post's comments, one level of replies, anonymous when allowed. */
export function Comments({
  postId,
  comments,
  anonymousAllowed,
}: {
  postId: string;
  comments: Comment[];
  anonymousAllowed: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const { gate, ask } = useGuidelinesGate();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<string | null>(null);
  const [support, setSupport] = useState(false);

  const top = comments.filter((c) => !c.parent_id);
  const replies = (parent: string) => comments.filter((c) => c.parent_id === parent);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const result = await createComment({
      post: postId,
      body,
      parent: replyTo?.parent_id ?? replyTo?.id ?? undefined,
      anonymous,
    });
    setBusy(false);
    if (!result.ok && result.error === GUIDELINES_REQUIRED) {
      if (await ask()) await submit(e);
      return;
    }
    if (!result.ok) return setError(result.error);
    if (result.data.held)
      toast.success("Thanks. A moderator will check your comment before it shows up.");
    if (mentionsSelfHarm(body)) setSupport(true);
    setBody("");
    setReplyTo(null);
    setError(undefined);
    router.refresh();
  }

  function Item({ c, nested }: { c: Comment; nested?: boolean }) {
    const name = c.author_name ?? "Student";
    return (
      <div className={cn("flex gap-3", nested && "ml-10")}>
        {c.is_anonymous ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-fill text-on-fill">
            <VenetianMask className="size-4" />
          </span>
        ) : (
          <Link href={`/people/${c.author_handle}`}>
            <Avatar name={name} src={c.author_avatar} size="sm" />
          </Link>
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate font-semibold">{name}</span>
            {c.is_op && (
              <Pill tone="brand" className="h-5 px-1.5 text-[10px]">
                OP
              </Pill>
            )}
            {c.created_at && <span className="text-xs text-sec">{shortTime(c.created_at)}</span>}
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Comment options"
                  className="hit ml-auto grid size-7 place-items-center rounded-pill text-sec hover:bg-raised"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </MenuTrigger>
              <MenuContent>
                {c.is_mine ? (
                  <MenuItem
                    danger
                    onSelect={async () => {
                      const r = await deleteComment(c.id!);
                      if (r.ok) router.refresh();
                      else setError(r.error);
                    }}
                  >
                    <Trash2 /> Delete
                  </MenuItem>
                ) : (
                  <MenuItem onSelect={() => setReporting(c.id!)}>
                    <Flag /> Report
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
          <p className="text-subhead break-words whitespace-pre-wrap">{c.body}</p>
          <button
            type="button"
            className="hit justify-self-start text-xs font-semibold text-sec hover:text-label"
            onClick={() => setReplyTo(c)}
          >
            Reply
          </button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4">
      <h2 id={`${id}-title`} className="text-lg font-bold">
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      <form onSubmit={submit} className="grid gap-2">
        {replyTo && (
          <p className="flex items-center justify-between rounded-field bg-raised px-3 py-1.5 text-sm">
            <span>
              Replying to <strong>{replyTo.author_name ?? "a comment"}</strong>
            </span>
            <button
              type="button"
              className="hit font-semibold text-sec"
              onClick={() => setReplyTo(null)}
            >
              Cancel
            </button>
          </p>
        )}
        <Textarea
          aria-label="Your comment"
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
          className="min-h-20"
        />
        <div className="flex items-center justify-between gap-2">
          {anonymousAllowed ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Comment anonymously
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" variant="cta" size="sm" disabled={busy || !body.trim()}>
            {busy && <Loader2 className="animate-spin" />} Comment
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {gate}
      </form>

      <ul className="grid gap-4">
        {top.map((c) => (
          <li key={c.id} className="grid gap-3">
            <Item c={c} />
            {replies(c.id!).map((r) => (
              <Item key={r.id} c={r} nested />
            ))}
          </li>
        ))}
      </ul>

      <ReportDialog
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Report comment"
        targetType="comment"
        targetId={reporting ?? ""}
      />
      <SupportDialog open={support} onOpenChange={setSupport} />
    </section>
  );
}
