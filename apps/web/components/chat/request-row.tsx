"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { respondConnection } from "@/actions/connect";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/** A connection request in the Requests tab, answered in place. */
export function RequestRow({
  requester,
  handle,
  name,
  avatar,
  note,
}: {
  requester: string;
  handle: string | null;
  name: string;
  avatar: string | null;
  note: string | null;
}) {
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function answer(accept: boolean) {
    setBusy(true);
    const result = await respondConnection(requester, accept);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(accept ? "accepted" : "declined");
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surface p-3">
      <Link href={handle ? `/people/${handle}` : "#"} className="flex items-center gap-3">
        <Avatar name={name} src={avatar} size="md" />
        <span className="grid min-w-0">
          <span className="truncate font-semibold">{name}</span>
          <span className="text-[13px] text-ink-2">wants to connect</span>
        </span>
      </Link>
      {note && <p className="text-sm">&ldquo;{note}&rdquo;</p>}
      {done ? (
        <p className="text-sm font-semibold text-ink-2">
          {done === "accepted" ? "Connected! Say hi from their profile." : "Declined"}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy} onClick={() => answer(true)}>
            <Check /> Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onClick={() => answer(false)}
          >
            <X /> Decline
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
