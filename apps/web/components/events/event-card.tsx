"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, Loader2, MapPin, Users } from "lucide-react";
import { cancelEvent, rsvpEvent } from "@/actions/campus";
import { Chip } from "@/components/ui/badge";
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
        "grid gap-3 rounded-lg border border-line bg-surface p-4",
        cancelled && "opacity-70",
      )}
    >
      <div className="grid gap-1">
        {e.society_name && (
          <Link href={`/events/s/${e.society_slug}`} className="text-sm font-semibold text-brand">
            {e.society_emoji && <span aria-hidden>{e.society_emoji} </span>}
            {e.society_name}
          </Link>
        )}
        <h3 className="text-lg leading-snug font-bold">{e.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <Clock className="size-4" aria-hidden /> {pkTime(e.starts_at)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <MapPin className="size-4" aria-hidden /> {e.venue}
        </p>
      </div>
      {e.description && <p className="text-sm whitespace-pre-wrap">{e.description}</p>}
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="outline" className="h-6 px-2 text-xs">
          <Users className="size-3.5" aria-hidden /> {e.going} going
          {e.capacity !== null && ` of ${e.capacity}`}
        </Chip>
        {e.interested > 0 && (
          <Chip tone="outline" className="h-6 px-2 text-xs">
            {e.interested} interested
          </Chip>
        )}
        {cancelled && (
          <Chip tone="outline" className="h-6 px-2 text-xs text-danger">
            Cancelled
          </Chip>
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
            className="flex h-9 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-brand"
          >
            <CalendarPlus className="size-4" /> Add to calendar
          </a>
          {e.can_manage && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelEvent(e.id);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Event cancelled. Everyone who RSVP'd was told.");
                  router.refresh();
                })
              }
            >
              Cancel event
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
