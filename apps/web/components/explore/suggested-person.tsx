"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestConnection, type ConnectionState } from "@/actions/connect";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { DirectoryPerson } from "@/lib/discovery";

/**
 * A "People like you" card (redesign §5.1 #5): avatar, name, department and year, the
 * strongest reason, and Connect (a request without a note; the profile has the full flow).
 */
export function SuggestedPerson({ person, reason }: { person: DirectoryPerson; reason?: string }) {
  const name = person.full_name ?? person.handle ?? "Student";
  const [state, setState] = useState<ConnectionState>("none");
  const [busy, setBusy] = useState(false);
  const line = [person.department_code, person.batch_year].filter(Boolean).join(" · ");

  async function connect() {
    if (!person.id) return;
    setBusy(true);
    const result = await requestConnection(person.id);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    setState(result.data);
  }

  return (
    <div className="flex h-full w-[164px] flex-col items-center gap-2 rounded-card bg-surface p-4 text-center shadow-card">
      <Link href={`/people/${person.handle}`} className="grid justify-items-center gap-2">
        <Avatar name={name} src={person.avatar_url} size={64} />
        <span className="grid">
          <span className="line-clamp-1 text-subhead font-semibold">{name}</span>
          {line && <span className="text-footnote text-ter">{line}</span>}
        </span>
      </Link>
      {reason && (
        <span className="line-clamp-1 max-w-full rounded-pill border border-sep px-2 py-0.5 text-footnote text-sec">
          {reason}
        </span>
      )}
      <div className="mt-auto w-full pt-1">
        {state === "none" ? (
          <Button size="sm" variant="tinted" block onClick={connect} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Connect
          </Button>
        ) : (
          <Button size="sm" variant="quiet" block asChild>
            <Link href={`/people/${person.handle}`}>
              <Check aria-hidden />
              {state === "connected" ? "Connected" : state === "incoming" ? "Respond" : "Requested"}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
