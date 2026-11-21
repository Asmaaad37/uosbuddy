"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { remindAllDeadlines, setReminder } from "@/actions/calendar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/toast";
import {
  byMonth,
  dateRange,
  monthGrid,
  onDay,
  whenLabel,
  type CalendarEvent,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const DAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Phase 11.4: the academic calendar as a list (by month) or a month grid. Coming dates have a
 * bell: a push two days before. Dates "subject to the moon" or a holiday notice say so.
 */
export function CalendarView({
  events,
  reminders,
  today,
}: {
  events: CalendarEvent[];
  reminders: string[];
  today: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "month">("list");
  const [showPast, setShowPast] = useState(false);
  const [pending, start] = useTransition();
  const reminded = new Set(reminders);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(done);
      router.refresh();
    });

  const shown = showPast ? events : events.filter((e) => (e.ends_on ?? e.starts_on) >= today);
  // Many dates share one note (every holiday says it depends on the government): show each note
  // once, on its first date.
  const noteShownOn = new Map<string, string>();
  for (const e of shown) if (e.notes && !noteShownOn.has(e.notes)) noteShownOn.set(e.notes, e.id);

  const row = (e: CalendarEvent) => {
    const future = e.starts_on > today;
    const on = reminded.has(e.id);
    return (
      <li key={e.id} className="flex items-start gap-3 px-4 py-3">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">{e.title}</span>
          <span className="text-footnote text-sec">
            {dateRange(e)} · {whenLabel(e, today)}
          </span>
          {e.tentative && (
            <span className="pt-1">
              <Pill tone="outline">Tentative</Pill>
            </span>
          )}
          {e.notes && noteShownOn.get(e.notes) === e.id && (
            <span className="pt-1 text-footnote text-ter">{e.notes}</span>
          )}
        </span>
        {future && (
          <button
            type="button"
            className={cn("hit shrink-0 rounded-pill p-1", on ? "bg-tint text-accent" : "text-ter")}
            aria-pressed={on}
            aria-label={on ? `Stop reminding me about ${e.title}` : `Remind me about ${e.title}`}
            disabled={pending}
            onClick={() =>
              run(
                () => setReminder(e.id, !on),
                on ? "Reminder off" : "We'll remind you 2 days before",
              )
            }
          >
            {/* On: a filled Blue bell on Sky; off: an outline bell (not shown by colour alone). */}
            <Bell className={cn("size-5", on && "fill-current")} />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      {events.some((e) => e.tentative) && (
        <p className="px-1 text-footnote text-sec">Tentative dates may still change.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="tinted"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await remindAllDeadlines();
              if (!r.ok) return void toast.error(r.error);
              toast.success(
                r.data
                  ? `${r.data} reminder${r.data === 1 ? "" : "s"} added`
                  : "You're already set",
              );
              router.refresh();
            })
          }
        >
          <Bell /> Remind me of every deadline
        </Button>
        <Button size="sm" variant="plain" asChild>
          <a href="/calendar/ics" download>
            <CalendarPlus /> Add to my phone calendar
          </a>
        </Button>
      </div>

      <SegmentedControl
        label="Calendar view"
        value={view}
        onChange={(v) => setView(v as "list" | "month")}
        segments={[
          { value: "list", label: "List" },
          { value: "month", label: "Month" },
        ]}
      />

      {view === "list" ? (
        <div className="grid gap-4">
          {byMonth(shown).map(([month, list]) => (
            <section key={month} aria-label={month} className="grid gap-2">
              <h2 className="px-4 text-overline text-ter uppercase">{month}</h2>
              <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
                {list.map(row)}
              </ul>
            </section>
          ))}
          {!shown.length && (
            <p className="rounded-card bg-surface p-4 text-center text-sec shadow-card">
              No more dates this year.
            </p>
          )}
          <div>
            <Button size="sm" variant="quiet" onClick={() => setShowPast(!showPast)}>
              {showPast ? "Hide past dates" : "Show past dates"}
            </Button>
          </div>
        </div>
      ) : (
        <MonthView events={events} today={today} row={row} />
      )}
    </div>
  );
}

function MonthView({
  events,
  today,
  row,
}: {
  events: CalendarEvent[];
  today: string;
  row: (e: CalendarEvent) => React.ReactNode;
}) {
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [selected, setSelected] = useState(today);
  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const move = (by: number) =>
    setCursor(({ year, month }) => {
      const m = month + by;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  const dayEvents = events.filter((e) => onDay(e, selected));

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-card bg-surface p-3 shadow-card">
        <div className="flex items-center justify-between">
          <Button size="icon" variant="quiet" aria-label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <h2 className="text-headline">
            {MONTH.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
          </h2>
          <Button size="icon" variant="quiet" aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight />
          </Button>
        </div>
        <table className="w-full table-fixed text-center text-subhead">
          <thead>
            <tr>
              {DAY_HEADS.map((d) => (
                <th key={d} scope="col" className="pb-1 text-footnote font-medium text-ter">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((day, j) => {
                  if (!day) return <td key={j} />;
                  const has = events.filter((e) => onDay(e, day));
                  return (
                    <td key={day} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => setSelected(day)}
                        aria-pressed={selected === day}
                        aria-label={`${day}${has.length ? `, ${has.map((e) => e.title).join(", ")}` : ""}`}
                        className={cn(
                          "grid h-11 w-full place-items-center rounded-field",
                          selected === day ? "bg-fill text-on-fill" : "hover:bg-raised",
                          day === today && selected !== day && "font-bold text-accent",
                        )}
                      >
                        <span>{Number(day.slice(8))}</span>
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-pill",
                            has.length
                              ? selected === day
                                ? "bg-on-fill"
                                : "bg-accent"
                              : "bg-transparent",
                          )}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label="Dates on the chosen day">
        {dayEvents.length ? (
          <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card">
            {dayEvents.map(row)}
          </ul>
        ) : (
          <p className="rounded-card bg-surface p-4 text-center text-sec shadow-card">
            Nothing on this day.
          </p>
        )}
      </section>
    </div>
  );
}
