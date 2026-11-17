"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flag, Loader2, MessageCircle, Repeat, Users } from "lucide-react";
import {
  cancelRide,
  cancelSeat,
  requestSeat,
  respondSeat,
  rideRequests,
  type RideRequest,
} from "@/actions/campus";
import { ReportDialog } from "@/components/connect/safety-menu";
import { useConfirm } from "@/components/ui/confirm";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { dayMonth, pkTime, recurringLabel } from "@/lib/campus";

export type Ride = {
  id: string;
  kind: string;
  from_area: string;
  to_area: string;
  depart_at: string;
  recurring_days: number[];
  recurring_until: string | null;
  seats: number;
  seats_taken: number;
  women_only: boolean;
  notes: string | null;
  status: string;
  conversation_id: string | null;
  user_id: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
  my_request: string | null;
};

/** Phase 8 task 1: one ride, with what the viewer can do next. */
export function RideCard({ ride, me }: { ride: Ride; me: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [requests, setRequests] = useState<RideRequest[] | null>(null);
  const [reporting, setReporting] = useState(false);
  const confirm = useConfirm();
  const mine = ride.user_id === me;
  const offer = ride.kind === "offer";
  const left = Math.max(ride.seats - ride.seats_taken, 0);
  const repeats = recurringLabel(ride.recurring_days);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      if (done) toast.success(done);
      router.refresh();
    });

  async function loadRequests() {
    const r = await rideRequests(ride.id);
    if (r.ok) setRequests(r.data);
    else toast.error(r.error);
  }

  return (
    <li className="grid gap-3 rounded-card border border-sep bg-surface p-3">
      <div className="flex items-start gap-3">
        <Avatar name={ride.full_name} src={ride.avatar_url} size="md" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            {ride.from_area} <ArrowRight className="size-4 text-sec" aria-label="to" />{" "}
            {ride.to_area}
          </p>
          <p className="text-sm text-sec">
            {pkTime(ride.depart_at)}
            {repeats && (
              <span className="ml-1.5 inline-flex items-center gap-1">
                <Repeat className="size-3.5" aria-hidden /> {repeats}
                {ride.recurring_until && ` until ${dayMonth(ride.recurring_until)}`}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Pill tone={offer ? "campus" : "neutral"} className="h-6 px-2 text-xs">
              {offer ? "Offering seats" : "Needs a lift"}
            </Pill>
            {offer && (
              <Pill tone="outline" className="h-6 px-2 text-xs">
                <Users className="size-3.5" aria-hidden />{" "}
                {ride.status === "full" ? "Full" : `${left} of ${ride.seats} seats left`}
              </Pill>
            )}
            {ride.women_only && (
              <Pill tone="people" className="h-6 px-2 text-xs">
                Women only
              </Pill>
            )}
            {ride.status === "cancelled" && (
              <Pill tone="outline" className="h-6 px-2 text-xs text-danger">
                Cancelled
              </Pill>
            )}
          </div>
          {ride.notes && <p className="text-sm">{ride.notes}</p>}
          <p className="text-xs text-sec">
            {mine ? "You" : <Link href={`/people/${ride.handle}`}>{ride.full_name}</Link>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ride.conversation_id && (
          <Link
            href={`/chats/${ride.conversation_id}`}
            className="flex h-9 items-center gap-1.5 rounded-pill bg-fill px-4 text-sm font-semibold text-on-fill"
          >
            <MessageCircle className="size-4" /> Ride chat
          </Link>
        )}
        {!mine && ride.status === "open" && !ride.my_request?.match(/pending|accepted/) && (
          <Button
            size="sm"
            disabled={pending || ride.my_request === "declined"}
            onClick={() =>
              run(() => requestSeat(ride.id), offer ? "Asked for a seat" : "Offered a lift")
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {ride.my_request === "declined"
              ? "Declined"
              : offer
                ? "Ask for a seat"
                : "Offer a lift"}
          </Button>
        )}
        {!mine && ride.my_request === "pending" && (
          <>
            <Pill tone="outline">Waiting for an answer</Pill>
            <Button
              size="sm"
              variant="quiet"
              disabled={pending}
              onClick={() => run(() => cancelSeat(ride.id))}
            >
              Withdraw
            </Button>
          </>
        )}
        {!mine && ride.my_request === "accepted" && (
          <Button
            size="sm"
            variant="quiet"
            disabled={pending}
            onClick={() => run(() => cancelSeat(ride.id), "You left the ride")}
          >
            Leave ride
          </Button>
        )}
        {!mine && (
          <Button size="sm" variant="quiet" onClick={() => setReporting(true)}>
            <Flag /> Report
          </Button>
        )}
        {mine && ride.status !== "cancelled" && (
          <>
            <Button size="sm" variant="tinted" onClick={() => void loadRequests()}>
              {offer ? "Seat requests" : "Lift offers"}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Cancel this ride?",
                  body: "Anyone with a seat or a request will be told.",
                  action: "Cancel ride",
                });
                if (ok) run(() => cancelRide(ride.id), "Ride cancelled");
              }}
            >
              Cancel ride
            </Button>
          </>
        )}
      </div>

      <ReportDialog
        open={reporting}
        onOpenChange={setReporting}
        title="Report ride"
        targetType="ride"
        targetId={ride.id}
      />

      {mine && requests && (
        <ul className="grid gap-2 border-t border-sep pt-3" aria-label="Requests">
          {requests.length === 0 && <li className="text-sm text-sec">No requests yet.</li>}
          {requests.map((q) => (
            <li key={q.id} className="flex items-center gap-3">
              <Avatar name={q.full_name} src={q.avatar_url} size="sm" />
              <div className="grid min-w-0 flex-1">
                <Link href={`/people/${q.handle}`} className="truncate text-sm font-semibold">
                  {q.full_name}
                </Link>
                {q.message && <span className="truncate text-xs text-sec">{q.message}</span>}
              </div>
              {q.status === "pending" ? (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        async () => {
                          const r = await respondSeat(q.id, true);
                          if (r.ok) await loadRequests();
                          return r;
                        },
                        `${q.full_name.split(" ")[0]} is in`,
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const r = await respondSeat(q.id, false);
                        if (r.ok) await loadRequests();
                        return r;
                      })
                    }
                  >
                    Decline
                  </Button>
                </div>
              ) : (
                <Pill tone="learn" className="h-6 px-2 text-xs">
                  In the ride
                </Pill>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
