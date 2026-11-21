"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { requestConnection, type ConnectionState } from "@/actions/connect";
import { ShareButton } from "@/components/discovery/share-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { DirectoryPerson } from "@/lib/discovery";

const card =
  "flex h-full w-[164px] flex-col items-center gap-3 rounded-[28px] bg-surface p-4 text-center shadow-card contrast-more:border contrast-more:border-label";

/**
 * A "People like you" card (explore-v2): avatar, name, one meta line (the strongest reason,
 * else department and year) and Connect. Connect shows "Requested" at once and goes back if
 * the request fails (optimistic). The profile has the full flow with a note.
 */
export function SuggestedPerson({ person, reason }: { person: DirectoryPerson; reason?: string }) {
  const name = person.full_name ?? person.handle ?? "Student";
  const [state, setState] = useState<ConnectionState>("none");
  const meta = reason ?? [person.department_code, person.batch_year].filter(Boolean).join(" · ");

  async function connect() {
    if (!person.id) return;
    setState("outgoing");
    const result = await requestConnection(person.id);
    if (!result.ok) {
      setState("none");
      return void toast.error(result.error);
    }
    setState(result.data);
  }

  return (
    <div className={card}>
      <Link href={`/people/${person.handle}`} className="grid justify-items-center gap-2">
        <Avatar name={name} src={person.avatar_url} size={64} />
        <span className="grid">
          <span className="line-clamp-1 text-headline font-bold">{name}</span>
          {meta && (
            <span className="line-clamp-1 text-footnote font-semibold text-sec">{meta}</span>
          )}
        </span>
      </Link>
      <div className="mt-auto w-full">
        {state === "none" ? (
          <Button size="md" variant="primary" block onClick={connect} className="h-11">
            Connect
          </Button>
        ) : (
          <Button size="md" variant="tinted" block asChild className="h-11">
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

/** Ends the "People like you" row: invite more of your batch. */
export function InviteCard({ url, text }: { url: string; text: string }) {
  return (
    <ShareButton
      url={url}
      text={text}
      label="Invite"
      icon="user-plus"
      variant="quiet"
      className="flex h-full w-[132px] flex-col gap-2 rounded-[28px] border-[1.5px] border-dashed border-line bg-transparent text-sec [&_svg]:size-6 [&_svg]:text-accent"
    />
  );
}
