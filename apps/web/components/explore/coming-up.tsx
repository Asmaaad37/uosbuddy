import Link from "next/link";
import { SectionHeader } from "@/components/ui/card";
import { dateRange, whenLabel, type CalendarEvent } from "@/lib/calendar";

/** Phase 11.4: the next three academic calendar dates on Explore. Hidden when there are none. */
export function ComingUp({ events, today }: { events: CalendarEvent[]; today: string }) {
  if (!events.length) return null;
  return (
    <section aria-labelledby="coming-up" className="grid gap-3">
      <SectionHeader
        id="coming-up"
        title="Coming up"
        trailing={
          <Link href="/calendar" className="hit">
            Calendar
          </Link>
        }
      />
      <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href="/calendar"
              className="flex items-center justify-between gap-3 px-4 py-3 active:bg-raised"
            >
              <span className="grid min-w-0">
                <span className="truncate font-medium">{e.title}</span>
                <span className="text-footnote text-sec">
                  {dateRange(e)}
                  {e.tentative ? " · tentative" : ""}
                </span>
              </span>
              <span className="shrink-0 text-footnote font-semibold text-accent">
                {whenLabel(e, today)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
