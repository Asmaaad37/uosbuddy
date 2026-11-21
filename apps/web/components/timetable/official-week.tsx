"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, MapPin, Plus, UserRound, X } from "lucide-react";
import {
  followClass,
  sectionCourses,
  setMyClassGroup,
  unfollowClass,
} from "@/actions/official-timetable";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Overline } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { DAYS, minToTime } from "@/lib/academics";
import { pakistanNow, type MyTimetable } from "@/lib/timetable/week";

type Group = { id: string; label: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
    then?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(done);
      then?.();
      router.refresh();
    });
  return { pending, run };
}

const updated = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
  });

/**
 * Phase 11.2: the official week for the student's section, with day chips. Their section comes
 * from their profile; they can choose another, and add classes from other sections.
 */
export function OfficialWeek({
  data,
  groups,
  published,
  term,
}: {
  data: MyTimetable;
  groups: Group[];
  /** Whether the student's department has a published timetable this term. */
  published: boolean;
  term: string;
}) {
  // Today in Pakistan (Sunday shows Monday); set after mount so server and client agree.
  const [day, setDay] = useState(0);
  useEffect(() => {
    const today = pakistanNow().day;
    setDay(today > 5 ? 0 : today);
  }, []);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState(false);
  const { pending, run } = useRun();

  if (!published && !data.group) {
    return (
      <EmptyState icon={CalendarClock} title="Timetable not published yet">
        Your department&apos;s timetable for {term} isn&apos;t published yet. Meanwhile, add your
        own classes below.
      </EmptyState>
    );
  }

  const classes = data.classes.filter((c) => c.day === day);

  return (
    <div className="grid gap-3">
      <Card className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <Overline>Your section</Overline>
            <p className="text-headline">{data.group?.label ?? "Not matched yet"}</p>
            <p className="text-footnote text-sec">
              {data.matched === "choice"
                ? "Chosen by you"
                : data.matched === "profile"
                  ? "From your profile"
                  : "Your profile doesn't match a section. Choose yours."}
              {data.published_at ? ` · Updated ${updated(data.published_at)}` : ""}
            </p>
          </div>
          <Button size="sm" variant="tinted" onClick={() => setChoosing(true)}>
            {data.group ? "Change" : "Choose"}
          </Button>
        </div>
      </Card>

      {data.group || data.classes.length ? (
        <>
          <div role="radiogroup" aria-label="Day" className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {DAYS.slice(0, 6).map((d, i) => (
              <Chip
                key={d}
                role="radio"
                aria-checked={day === i}
                selected={day === i}
                onClick={() => setDay(i)}
              >
                {d}
              </Chip>
            ))}
          </div>
          <section aria-label={`Classes on ${DAYS[day]}`} className="grid gap-2">
            {classes.length ? (
              <ul className="grid gap-2">
                {classes.map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-3 rounded-card bg-surface p-3 shadow-card contrast-more:border contrast-more:border-label"
                  >
                    <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                      {minToTime(c.start_min)}–{minToTime(c.end_min)}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-medium">{c.course_title}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-sec">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />{" "}
                          {c.room_id ? (
                            <Link
                              className="underline-offset-2 hover:underline"
                              href={`/timetable/room/${c.room_id}`}
                            >
                              {c.room_label}
                            </Link>
                          ) : (
                            c.room_label
                          )}
                        </span>
                        {c.teacher_name && (
                          <span className="flex items-center gap-1">
                            <UserRound className="size-3" aria-hidden />{" "}
                            {c.teacher_id ? (
                              <Link
                                className="underline-offset-2 hover:underline"
                                href={`/timetable/teacher/${c.teacher_id}`}
                              >
                                {c.teacher_name}
                              </Link>
                            ) : (
                              c.teacher_name
                            )}
                          </span>
                        )}
                      </span>
                      {(c.practical || c.group_label) && (
                        <span className="flex flex-wrap gap-1.5 pt-1">
                          {c.practical && <Pill>Practical</Pill>}
                          {c.group_label && <Pill tone="outline">{c.group_label}</Pill>}
                        </span>
                      )}
                    </span>
                    {c.follow_id && (
                      <button
                        type="button"
                        className="hit self-start text-ter hover:text-label"
                        aria-label={`Remove ${c.course_title} from my week`}
                        disabled={pending}
                        onClick={() => run(() => unfollowClass(c.follow_id!), "Removed")}
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card bg-surface p-4 text-center text-sec shadow-card">
                No classes on {DAYS[day]}.
              </p>
            )}
          </section>
        </>
      ) : null}

      <div>
        <Button size="sm" variant="plain" onClick={() => setAdding(true)}>
          <Plus /> Add a class from another section
        </Button>
      </div>

      <ChooseSection
        open={choosing}
        onOpenChange={setChoosing}
        groups={groups}
        current={data.matched === "choice" ? (data.group?.id ?? "") : ""}
        pending={pending}
        onSave={(group) =>
          run(
            () => setMyClassGroup(group),
            group ? "Section saved" : "Using your profile",
            () => setChoosing(false),
          )
        }
      />
      <AddClass open={adding} onOpenChange={setAdding} groups={groups} />
    </div>
  );
}

function ChooseSection({
  open,
  onOpenChange,
  groups,
  current,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  current: string;
  pending: boolean;
  onSave: (group: string | null) => void;
}) {
  const [value, setValue] = useState(current);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <SheetTitle className="text-title3">Your section</SheetTitle>
            <SheetDescription className="text-sec">
              Pick the program, batch and section on your timetable. Your profile isn&apos;t
              changed.
            </SheetDescription>
          </div>
          <NativeSelect
            aria-label="Section"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Match my profile</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
          <Button variant="cta" block disabled={pending} onClick={() => onSave(value || null)}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddClass({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
}) {
  const [group, setGroup] = useState("");
  const [course, setCourse] = useState("");
  const [courses, setCourses] = useState<
    { course_id: string; title: string; code: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const { pending, run } = useRun();

  async function pickGroup(value: string) {
    setGroup(value);
    setCourse("");
    setCourses([]);
    if (!value) return;
    setLoading(true);
    const r = await sectionCourses(value);
    setLoading(false);
    if (!r.ok) return void toast.error(r.error);
    setCourses(r.data);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <SheetTitle className="text-title3">Add a class</SheetTitle>
            <SheetDescription className="text-sec">
              Repeating a course, or taking one with another section? Add that section&apos;s class
              to your week.
            </SheetDescription>
          </div>
          <NativeSelect
            aria-label="Section"
            value={group}
            onChange={(e) => pickGroup(e.target.value)}
          >
            <option value="">Choose a section</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Course"
            value={course}
            disabled={!group || loading}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">{loading ? "Loading…" : "Choose a course"}</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.title}
                {c.code ? ` · ${c.code}` : ""}
              </option>
            ))}
          </NativeSelect>
          <Button
            block
            disabled={!group || !course || pending}
            onClick={() =>
              run(
                () => followClass(group, course),
                "Added to your week",
                () => onOpenChange(false),
              )
            }
          >
            Add to my week
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
