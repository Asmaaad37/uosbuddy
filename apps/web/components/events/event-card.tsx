"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, Flag, Loader2, MapPin, Users } from "lucide-react";
import { cancelEvent, rsvpEvent } from "@/actions/campus";
import { ReportDialog } from "@/components/connect/safety-menu";
import { useConfirm } from "@/components/ui/confirm";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { pkTime } from "@/lib/campus";
import { cn } from "@/lib/utils";

export type EventItem = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  capacity: number | null;
  status: string;
  society_name: string | null;
  society_slug: string | null;
  society_emoji: string | null;
  going: number;
  interested: number;
  my_rsvp: string | null;
  can_manage: boolean;
};

/** Phase 8 task 3: one event with RSVP and calendar export. */
export function EventCard({ event: e }: { event: EventItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const confirm = useConfirm();
  const cancelled = e.status === "cancelled";
  const full = e.capacity !== null && e.going >= e.capacity && e.my_rsvp !== "going";

  const rsvp = (status: "going" | "interested" | null) =>
    start(async () => {
      const r = await rsvpEvent(e.id, status);
      if (!r.ok) return void toast.error(r.error);
      if (status) toast.success(status === "going" ? "See you there" : "We'll remind you");
      router.refresh();
    });

  return (
    <article
      aria-label={e.title}
      className={cn(
        "grid gap-3 rounded-card border border-sep bg-surface p-4",
        cancelled && "opacity-70",
      )}
    >
      <div className="grid gap-1">
        {e.society_name && (
          <Link href={`/events/s/${e.society_slug}`} className="text-sm font-semibold text-accent">
            {e.society_emoji && <span aria-hidden>{e.society_emoji} </span>}
            {e.society_name}
          </Link>
        )}
        <h3 className="text-lg leading-snug font-bold">{e.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-sec">
          <Clock className="size-4" aria-hidden /> {pkTime(e.starts_at)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-sec">
          <MapPin className="size-4" aria-hidden /> {e.venue}
        </p>
      </div>
      {e.description && <p className="text-sm whitespace-pre-wrap">{e.description}</p>}
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="outline" className="h-6 px-2 text-xs">
          <Users className="size-3.5" aria-hidden /> {e.going} going
          {e.capacity !== null && ` of ${e.capacity}`}
        </Pill>
        {e.interested > 0 && (
          <Pill tone="outline" className="h-6 px-2 text-xs">
            {e.interested} interested
          </Pill>
        )}
        {cancelled && (
          <Pill tone="outline" className="h-6 px-2 text-xs text-danger">
            Cancelled
          </Pill>
        )}
      </div>
      {!cancelled && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5" role="group" aria-label="Your RSVP">
            <Button
              size="sm"
              variant={e.my_rsvp === "going" ? "primary" : "secondary"}
              aria-pressed={e.my_rsvp === "going"}
              disabled={pending || full}
              onClick={() => rsvp(e.my_rsvp === "going" ? null : "going")}
            >
              {pending && <Loader2 className="animate-spin" />}
              {full ? "Full" : "Going"}
            </Button>
            <Button
              size="sm"
              variant={e.my_rsvp === "interested" ? "primary" : "secondary"}
              aria-pressed={e.my_rsvp === "interested"}
              disabled={pending}
              onClick={() => rsvp(e.my_rsvp === "interested" ? null : "interested")}
            >
              Interested
            </Button>
          </div>
          <a
            href={`/events/${e.id}/ics`}
            className="hit flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-accent"
          >
            <CalendarPlus className="size-4" /> Add to calendar
          </a>
          {e.can_manage && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Cancel ${e.title}?`,
                  body: "Everyone who RSVP'd will be told. This can't be undone.",
                  action: "Cancel event",
                });
                if (!ok) return;
                start(async () => {
                  const r = await cancelEvent(e.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Event cancelled. Everyone who RSVP'd was told.");
                  router.refresh();
                });
              }}
            >
              Cancel event
            </Button>
          )}
          {!e.can_manage && (
            <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>
              <Flag /> Report
            </Button>
          )}
        </div>
      )}
      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        title="Report event"
        targetType="event"
        targetId={e.id}
      />
    </article>
  );
}
