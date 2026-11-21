import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { dateRange, whenLabel, type CalendarEvent } from "@/lib/calendar";

/**
 * The next academic calendar date on Explore, as one row (the calendar has the rest).
 * Hidden when there's none coming.
 */
export function ComingUp({ events, today }: { events: CalendarEvent[]; today: string }) {
  const next = events[0];
  if (!next) return null;
  return (
    <Link
      href="/calendar"
      className="flex items-center gap-3 rounded-card bg-surface p-3 pr-4 shadow-card transition-transform duration-100 ease-out active:scale-[0.98] contrast-more:border contrast-more:border-label"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-field bg-sky">
        <CalendarDays className="size-5 text-accent" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-subhead font-semibold">{next.title}</span>
        <span className="text-footnote font-semibold text-sec">
          {dateRange(next)}
          {next.tentative ? " · tentative" : ""}
        </span>
      </span>
      <span className="shrink-0 text-footnote font-bold text-accent">{whenLabel(next, today)}</span>
      <ChevronRight className="size-[18px] shrink-0 text-ter" aria-hidden />
    </Link>
  );
}
