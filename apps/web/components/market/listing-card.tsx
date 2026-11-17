"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Flag, MapPin, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { deleteListing, markListingDone } from "@/actions/campus";
import { startDm } from "@/actions/chat";
import { ReportDialog } from "@/components/connect/safety-menu";
import { useConfirm } from "@/components/ui/confirm";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PrivateImage } from "@/components/ui/private-image";
import { toast } from "@/components/ui/toast";
import { LISTING_KINDS, pkr, type ListingKind } from "@/lib/campus";
import { shortTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

export type Listing = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  description: string;
  price_pkr: number | null;
  media_paths: string[];
  location_hint: string | null;
  status: string;
  user_id: string;
  handle: string;
  full_name: string;
};

/** Phase 8 task 2: one listing. Message the seller, or manage your own. */
export function ListingCard({ listing: l, me }: { listing: Listing; me: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const confirm = useConfirm();
  const kind = LISTING_KINDS[l.kind as ListingKind] ?? LISTING_KINDS.sell;
  const mine = l.user_id === me;
  const done = l.status === "done";
  const price = l.kind === "free" ? "Free" : pkr(l.price_pkr);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      if (msg) toast.success(msg);
      router.refresh();
    });

  function message() {
    start(async () => {
      const r = await startDm(l.user_id);
      if (!r.ok) return void toast.error(r.error);
      router.push(`/chats/${r.data}?draft=${encodeURIComponent(`Hi! About "${l.title}"…`)}`);
    });
  }

  return (
    <article
      aria-label={l.title}
      className={cn(
        "grid gap-3 rounded-card bg-surface p-3 shadow-card contrast-more:border contrast-more:border-label",
        done && "opacity-70",
      )}
    >
      {l.media_paths.length > 0 && (
        <div className="-mx-3 -mt-3 grid auto-cols-[85%] grid-flow-col gap-1 overflow-x-auto rounded-t-card">
          {l.media_paths.map((p) => (
            <PrivateImage
              key={p}
              bucket="listing-media"
              path={p}
              alt={l.title}
              className="aspect-[4/3] w-full"
            />
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="campus" className="h-6 px-2 text-xs">
              <span aria-hidden>{kind.emoji}</span> {kind.label}
            </Pill>
            {done && (
              <Pill tone="outline" className="h-6 px-2 text-xs">
                {kind.doneLabel}
              </Pill>
            )}
            {l.status === "held" && (
              <Pill tone="outline" className="h-6 px-2 text-xs">
                Under review
              </Pill>
            )}
          </div>
          <h3 className="text-body leading-snug font-bold">{l.title}</h3>
          {price && <p className="text-lg font-bold text-accent">{price}</p>}
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button size="icon" variant="quiet" aria-label="More">
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            {mine ? (
              <MenuItem
                onSelect={async () => {
                  const ok = await confirm({
                    title: "Delete this listing?",
                    action: "Delete listing",
                  });
                  if (ok) run(() => deleteListing(l.id), "Listing deleted");
                }}
              >
                <Trash2 /> Delete
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => setReporting(true)}>
                <Flag /> Report
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </div>
      {l.description && <p className="text-sm whitespace-pre-wrap">{l.description}</p>}
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-sec">
        {mine ? "You" : <Link href={`/people/${l.handle}`}>{l.full_name}</Link>}
        <span>· {shortTime(l.created_at)}</span>
        {l.location_hint && (
          <span className="inline-flex items-center gap-1">
            · <MapPin className="size-3" aria-hidden /> {l.location_hint}
          </span>
        )}
      </p>
      {!done && (
        <div className="flex gap-2">
          {mine ? (
            l.status === "active" && (
              <Button
                size="sm"
                variant="tinted"
                disabled={pending}
                onClick={() => run(() => markListingDone(l.id), "Marked done")}
              >
                <Check /> {kind.done}
              </Button>
            )
          ) : (
            <Button size="sm" disabled={pending} onClick={message}>
              <MessageCircle /> Message
            </Button>
          )}
        </div>
      )}
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        title="Report listing"
        targetType="listing"
        targetId={l.id}
      />
    </article>
  );
}
