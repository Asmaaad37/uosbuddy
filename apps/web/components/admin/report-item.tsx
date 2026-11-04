"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, EyeOff, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { dismissReports, moderateContent, setBanned, warnUser } from "@/actions/trust";
import { Chip } from "@/components/ui/badge";
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

const HIDEABLE = ["post", "comment", "listing", "resource", "ride", "event"];
const LIVE = ["published", "active", "open"];

/** Phase 9: one reported or held item with what staff can do about it. */
export function ReportItem({ row: r, isAdmin }: { row: QueueRow; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"warn" | "ban" | null>(null);
  const [text, setText] = useState("");
  const hidden = !LIVE.includes(r.status);

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
    <li className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="neutral" className="h-6 px-2 text-xs capitalize">
          {r.target_type}
        </Chip>
        {r.report_count > 0 && (
          <Chip tone="help" className="h-6 px-2 text-xs">
            {r.report_count} {r.report_count === 1 ? "report" : "reports"}: {r.reasons.join(", ")}
          </Chip>
        )}
        {r.status === "held" && (
          <Chip tone="outline" className="h-6 px-2 text-xs">
            Held for review
          </Chip>
        )}
        {r.space && (
          <Chip tone="outline" className="h-6 px-2 text-xs">
            {r.space === "campus" ? "Campus feed" : "Department feed"}
          </Chip>
        )}
      </div>
      <p className="text-[15px] whitespace-pre-wrap">{r.preview || "(no text)"}</p>
      {r.details.length > 0 && (
        <ul className="grid gap-1 text-sm text-ink-2">
          {r.details.map((d, i) => (
            <li key={i}>“{d}”</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-2">
        By{" "}
        {r.author_handle ? (
          <Link href={`/people/${r.author_handle}`} className="font-semibold">
            {r.author_name}
          </Link>
        ) : (
          "a deleted account"
        )}
        {r.is_anonymous && " (posted anonymously; only staff see this)"}
      </p>

      <div className="flex flex-wrap gap-2">
        {HIDEABLE.includes(r.target_type) &&
          (hidden ? (
            <Button
              size="sm"
              variant="secondary"
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
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    moderateContent({
                      type: r.target_type,
                      id: r.target_id,
                      action: "hide",
                      reason: r.reasons[0],
                    }),
                  "Removed",
                )
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <EyeOff />} Remove
            </Button>
          ))}
        {r.report_count > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() => dismissReports(r.target_type, r.target_id), "Reports dismissed")
            }
          >
            <Check /> Dismiss reports
          </Button>
        )}
        {r.author_id && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMode(mode === "warn" ? null : "warn")}
          >
            <TriangleAlert /> Warn
          </Button>
        )}
        {r.author_id && isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === "ban" ? null : "ban")}>
            <Ban /> Ban
          </Button>
        )}
      </div>
      {mode && r.author_id && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                mode === "warn"
                  ? warnUser(r.author_id!, text)
                  : setBanned(r.author_id!, true, text),
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
            variant={mode === "ban" ? "danger" : "primary"}
            disabled={pending}
          >
            {mode === "warn" ? "Send" : "Ban"}
          </Button>
        </form>
      )}
    </li>
  );
}
