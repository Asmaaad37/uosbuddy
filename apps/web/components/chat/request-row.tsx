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
    <div className="grid gap-3 rounded-card bg-surface p-4 shadow-card">
      <Link href={handle ? `/people/${handle}` : "#"} className="flex items-center gap-3">
        <Avatar name={name} src={avatar} size="md" />
        <span className="grid min-w-0">
          <span className="truncate text-headline">{name}</span>
          <span className="text-footnote text-ter">wants to connect</span>
        </span>
      </Link>
      {note && <p className="text-body">&ldquo;{note}&rdquo;</p>}
      {done ? (
        <p className="text-subhead font-semibold text-sec">
          {done === "accepted" ? "Connected! Say hi from their profile." : "Declined"}
        </p>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy} onClick={() => answer(true)}>
            <Check /> Accept
          </Button>
          <Button
            size="sm"
            variant="quiet"
            className="flex-1"
            disabled={busy}
            onClick={() => answer(false)}
          >
            <X /> Decline
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
