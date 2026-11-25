import Link from "next/link";
import { MapPin, UserRound, Users } from "lucide-react";
import { ReportWrongInfo } from "@/components/timetable/report-wrong-info";
import { Pill } from "@/components/ui/badge";
import { DAYS, minToTime } from "@/lib/academics";

export type ViewClass = {
  id: string;
  course_title: string;
  course_code: string | null;
  room_label: string;
  room_id: string | null;
  teacher_name: string | null;
  teacher_id: string | null;
  day: number;
  start_min: number;
  end_min: number;
  practical: boolean;
  group_label: string | null;
  group_id: string | null;
};

const link = "underline-offset-2 hover:underline";

/**
 * Phase 11.3: a week of classes grouped by day, for section, teacher and room views. Rooms,
 * teachers and sections link to their own week, except the one this page is about.
 */
export function ClassList({
  classes,
  hide,
}: {
  classes: ViewClass[];
  hide: "section" | "teacher" | "room";
}) {
  const days = DAYS.slice(0, 7)
    .map((name, day) => ({ name, list: classes.filter((c) => c.day === day) }))
    .filter((d) => d.list.length);
  return (
    <div className="grid gap-3">
      {days.map(({ name, list }) => (
        <section
          key={name}
          aria-label={name}
          className="grid gap-2 rounded-card bg-surface p-3 shadow-card contrast-more:border contrast-more:border-label"
        >
          <h3 className="font-bold">{name}</h3>
          <ul className="grid gap-2">
            {list.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-field bg-raised px-3 py-2">
                <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                  {minToTime(c.start_min)}–{minToTime(c.end_min)}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">
                    {c.course_title}
                    {c.practical && (
                      <Pill className="ml-2 align-middle" tone="neutral">
                        Practical
                      </Pill>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-sec">
                    {hide !== "room" && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {c.room_id ? (
                          <Link className={link} href={`/timetable/room/${c.room_id}`}>
                            {c.room_label}
                          </Link>
                        ) : (
                          c.room_label
                        )}
                      </span>
                    )}
                    {hide !== "teacher" && c.teacher_name && (
                      <span className="flex items-center gap-1">
                        <UserRound className="size-3" aria-hidden />
                        {c.teacher_id ? (
                          <Link className={link} href={`/timetable/teacher/${c.teacher_id}`}>
                            {c.teacher_name}
                          </Link>
                        ) : (
                          c.teacher_name
                        )}
                      </span>
                    )}
                    {hide !== "section" && c.group_label && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {c.group_id ? (
                          <Link className={link} href={`/timetable/section/${c.group_id}`}>
                            {c.group_label}
                          </Link>
                        ) : (
                          c.group_label
                        )}
                      </span>
                    )}
                  </span>
                </span>
                <ReportWrongInfo
                  entryId={c.id}
                  label={`${c.course_title}, ${DAYS[c.day]} ${minToTime(c.start_min)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
