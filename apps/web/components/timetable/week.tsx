"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { deleteSlot, saveSlot } from "@/actions/timetable";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DAYS, minToTime, timeToMin } from "@/lib/academics";

export type Slot = {
  id: string;
  day: number;
  start_min: number;
  end_min: number;
  label: string;
  room: string | null;
  course_id: string | null;
};
type Course = { id: string; code: string; title: string };

const pad = (min: number) => minToTime(min).padStart(5, "0");

/** Phase 6 task 5: your week, Monday to Saturday, with add and edit. */
export function Week({ slots, courses }: { slots: Slot[]; courses: Course[] }) {
  const [editing, setEditing] = useState<Partial<Slot> | null>(null);

  return (
    <div className="grid gap-3">
      {DAYS.slice(0, 6).map((day, i) => {
        const list = slots.filter((s) => s.day === i).sort((a, b) => a.start_min - b.start_min);
        return (
          <section
            key={day}
            aria-label={day}
            className="grid gap-2 rounded-card border border-sep bg-surface p-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{day}</h3>
              <button
                type="button"
                className="hit flex items-center gap-1 text-sm font-semibold text-accent"
                onClick={() => setEditing({ day: i, start_min: 540, end_min: 630 })}
                aria-label={`Add a class on ${day}`}
              >
                <Plus className="size-4" /> Add
              </button>
            </div>
            {list.length ? (
              <ul className="grid gap-1.5">
                {list.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="flex w-full items-center gap-3 rounded-field bg-raised/15 px-3 py-2 text-left hover:bg-raised/25"
                    >
                      <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                        {minToTime(s.start_min)}–{minToTime(s.end_min)}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-medium">{s.label}</span>
                        {s.room && (
                          <span className="flex items-center gap-1 text-xs text-sec">
                            <MapPin className="size-3" /> {s.room}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-sec">No classes</p>
            )}
          </section>
        );
      })}
      {editing && <SlotSheet slot={editing} courses={courses} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SlotSheet({
  slot,
  courses,
  onClose,
}: {
  slot: Partial<Slot>;
  courses: Course[];
  onClose: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [day, setDay] = useState(slot.day ?? 0);
  const [start, setStart] = useState(pad(slot.start_min ?? 540));
  const [end, setEnd] = useState(pad(slot.end_min ?? 630));
  const [course, setCourse] = useState(slot.course_id ?? "");
  const [label, setLabel] = useState(slot.label ?? "");
  const [room, setRoom] = useState(slot.room ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const s = timeToMin(start);
    const en = timeToMin(end);
    if (s === null || en === null) return setError("Use times like 09:30");
    const picked = courses.find((c) => c.id === course);
    setBusy(true);
    const r = await saveSlot({
      id: slot.id,
      day,
      start: s,
      end: en,
      label: label.trim() || (picked ? `${picked.code} ${picked.title}` : ""),
      room: room || undefined,
      course: course || undefined,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!slot.id) return;
    setBusy(true);
    const r = await deleteSlot(slot.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onClose();
    router.refresh();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">
          {slot.id ? "Edit class" : "Add a class"}
        </SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          Only you see your timetable. Connections only ever see when you&apos;re busy.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field id={`${id}-day`} label="Day">
            {(aria) => (
              <NativeSelect {...aria} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAYS.slice(0, 6).map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-start`} label="Starts">
              {(aria) => (
                <Input
                  {...aria}
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
            <Field id={`${id}-end`} label="Ends">
              {(aria) => (
                <Input {...aria} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              )}
            </Field>
          </div>
          {courses.length > 0 && (
            <Field id={`${id}-course`} label="Course (optional)">
              {(aria) => (
                <NativeSelect {...aria} value={course} onChange={(e) => setCourse(e.target.value)}>
                  <option value="">Not one of my courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}
          <Field id={`${id}-label`} label={course ? "Label (optional)" : "What is it?"}>
            {(aria) => (
              <Input
                {...aria}
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Data Structures lab"
              />
            )}
          </Field>
          <Field id={`${id}-room`} label="Room (optional)">
            {(aria) => (
              <Input
                {...aria}
                value={room}
                maxLength={40}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="CS-12"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {slot.id && (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                disabled={busy}
                aria-label="Delete class"
              >
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Save
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
