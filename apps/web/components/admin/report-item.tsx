"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Eye, EyeOff, FileText, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import {
  dismissReports,
  moderateContent,
  revealAuthor,
  setBanned,
  warnUser,
} from "@/actions/trust";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export type QueueRow = {
  target_type: string;
  target_id: string;
  status: string;
  report_count: number;
  reasons: string[];
  details: string[];
  preview: string;
  space: string | null;
  author_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  is_anonymous: boolean;
};

const HIDEABLE = ["post", "comment", "listing", "resource", "ride", "event", "message"];
const LIVE = ["published", "active", "open"];

/** Phase 9: one reported or held item with what staff can do about it. */
export function ReportItem({
  row: r,
  media,
  isAdmin,
}: {
  row: QueueRow;
  media: { url: string; image: boolean }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"warn" | "ban" | null>(null);
  const [text, setText] = useState("");
  const hidden = !LIVE.includes(r.status);
  // Whoever started a reported chat may not be who it's about, so warn or ban from People.
  const isChat = r.target_type === "conversation";
  // Nobody sees who wrote an anonymous item until an admin presses Reveal, which is audited.
  const [revealed, setRevealed] = useState<{
    id: string;
    full_name: string | null;
    handle: string | null;
  } | null>(null);
  const authorId = revealed?.id ?? r.author_id;
  const authorHandle = revealed?.handle ?? r.author_handle;
  const authorName = revealed?.full_name ?? r.author_name;
  const canAct = !!authorId && !isChat;
  // Removing a message can't be undone, so it takes a second press.
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Something went wrong");
      toast.success(done);
      setMode(null);
      setText("");
      router.refresh();
    });

  return (
    <li className="grid gap-3 rounded-card border border-sep bg-surface p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="neutral" className="h-6 px-2 text-xs capitalize">
          {r.target_type}
        </Pill>
        {r.report_count > 0 && (
          <Pill tone="help" className="h-6 px-2 text-xs">
            {r.report_count} {r.report_count === 1 ? "report" : "reports"}:{" "}
            {r.reasons.map((x) => (x === "self_harm" ? "may hurt themselves" : x)).join(", ")}
          </Pill>
        )}
        {r.status === "held" && (
          <Pill tone="outline" className="h-6 px-2 text-xs">
            Held for review
          </Pill>
        )}
        {r.space && (
          <Pill tone="outline" className="h-6 px-2 text-xs">
            {r.space === "campus" ? "Campus feed" : "Department feed"}
          </Pill>
        )}
      </div>
      <p className="text-subhead whitespace-pre-wrap">
        {r.preview || (media.length ? "(no text, see below)" : "(no text)")}
      </p>
      {media.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {media.map((m) => (
            <li key={m.url}>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-field border border-sep"
              >
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
                  <img src={m.url} alt="Reported file" className="size-32 object-cover" />
                ) : (
                  <span className="flex h-11 items-center gap-2 px-3 text-sm font-semibold text-accent">
                    <FileText className="size-4" aria-hidden /> Open the file
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
      {r.details.length > 0 && (
        <ul className="grid gap-1 text-sm text-sec">
          {r.details.map((d, i) => (
            <li key={i}>“{d}”</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-sec">
        {r.is_anonymous && !revealed ? (
          <>
            <span>Posted anonymously</span>
            {isAdmin && (
              <Button
                size="sm"
                variant="quiet"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await revealAuthor(r.target_type, r.target_id);
                    if (!res.ok) return void toast.error(res.error);
                    setRevealed(res.data);
                  })
                }
              >
                <Eye /> Reveal author
              </Button>
            )}
          </>
        ) : (
          <p>
            {isChat ? "Started by" : "By"}{" "}
            {authorHandle ? (
              <Link href={`/people/${authorHandle}`} className="font-semibold">
                {authorName}
              </Link>
            ) : (
              (authorName ?? "a deleted account")
            )}
            {revealed && " (posted anonymously; this look is on record)"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {HIDEABLE.includes(r.target_type) &&
          (hidden ? (
            r.target_type !== "message" && (
              <Button
                size="sm"
                variant="tinted"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      moderateContent({ type: r.target_type, id: r.target_id, action: "restore" }),
                    "Restored",
                  )
                }
              >
                <RotateCcw /> Restore
              </Button>
            )
          ) : (
            <Button
              size="sm"
              disabled={pending}
              variant={confirming ? "destructive" : "primary"}
              onClick={() => {
                if (r.target_type === "message" && !confirming) return setConfirming(true);
                run(
                  () =>
                    moderateContent({
                      type: r.target_type,
                      id: r.target_id,
                      action: "hide",
                      reason: r.reasons[0],
                    }),
                  "Removed",
                );
              }}
            >
              {pending ? <Loader2 className="animate-spin" /> : <EyeOff />}{" "}
              {confirming ? "Erase for everyone?" : "Remove"}
            </Button>
          ))}
        {r.report_count > 0 && (
          <Button
            size="sm"
            variant="quiet"
            disabled={pending}
            onClick={() =>
              run(() => dismissReports(r.target_type, r.target_id), "Reports dismissed")
            }
          >
            <Check /> Dismiss reports
          </Button>
        )}
        {canAct && (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setMode(mode === "warn" ? null : "warn")}
          >
            <TriangleAlert /> Warn
          </Button>
        )}
        {canAct && isAdmin && (
          <Button size="sm" variant="quiet" onClick={() => setMode(mode === "ban" ? null : "ban")}>
            <Ban /> Ban
          </Button>
        )}
      </div>
      {mode && authorId && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => (mode === "warn" ? warnUser(authorId, text) : setBanned(authorId, true, text)),
              mode === "warn" ? "Warning sent" : "Account banned",
            );
          }}
        >
          <Input
            aria-label={mode === "warn" ? "Warning message" : "Reason for the ban"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "warn" ? "Please keep it respectful…" : "Repeated harassment"}
            maxLength={500}
          />
          <Button
            type="submit"
            size="sm"
            variant={mode === "ban" ? "destructive" : "primary"}
            disabled={pending}
          >
            {mode === "warn" ? "Send" : "Ban"}
          </Button>
        </form>
      )}
    </li>
  );
}
