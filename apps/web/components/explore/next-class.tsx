"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Card, Overline } from "@/components/ui/card";
import { minToTime } from "@/lib/academics";
import { duration, nowNext, pakistanNow, type NowNext, type WeekItem } from "@/lib/timetable/week";

/**
 * Phase 11.2: "Next class" on Explore, from the student's official week and their own classes.
 * Worked out on the device in Pakistan time and refreshed every minute. Hidden on a day with
 * no classes, rather than showing a gap.
 */
export function NextClass({ items }: { items: WeekItem[] }) {
  const [state, setState] = useState<NowNext | null>(null);
  useEffect(() => {
    const tick = () => setState(nowNext(items, pakistanNow()));
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [items]);

  if (!state || state.state === "none") return null;
  if (state.state === "done") {
    return (
      <Card className="flex items-center gap-3 p-4">
        <Clock className="size-5 text-sec" aria-hidden />
        <p className="text-subhead text-sec">No more classes today.</p>
      </Card>
    );
  }
  const { item } = state;
  return (
    <Link href="/timetable" className="block rounded-card active:scale-[0.99]">
      <Card className="grid gap-1 p-4">
        <Overline>{state.state === "now" ? "Now" : "Next class"}</Overline>
        <p className="text-headline">{item.title}</p>
        <p className="text-subhead text-sec">
          {minToTime(item.start_min)}–{minToTime(item.end_min)}
          {item.room ? ` · ${item.room}` : ""}
          {item.teacher ? ` · ${item.teacher}` : ""}
        </p>
        <p className="text-footnote font-semibold text-accent">
          {state.state === "now"
            ? `Ends in ${duration(state.minutesLeft)}`
            : `In ${duration(state.minutesUntil)}`}
        </p>
      </Card>
    </Link>
  );
}
