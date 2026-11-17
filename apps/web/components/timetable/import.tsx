"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { saveSlots } from "@/actions/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { DAYS, minToTime, timeToMin } from "@/lib/academics";
import type { Draft } from "@/lib/ai/timetable";

type Row = Omit<Draft, "start" | "end"> & { key: number; start: string; end: string };

const pad = (min: number) => minToTime(min).padStart(5, "0");

/** Phase 7 task 6: read a timetable screenshot, let the student fix it, then save. */
export function ImportTimetable() {
  const id = useId();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>();

  async function read(file: File) {
    setError(undefined);
    setReading(true);
    try {
      const body = new FormData();
      body.set("image", file);
      const res = await fetch("/api/timetable/import", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { classes?: Draft[]; error?: string };
      if (!res.ok || !data.classes) {
        toast.error(data.error ?? "Couldn't read that timetable. Try again.");
        return;
      }
      setRows(data.classes.map((c, key) => ({ ...c, key, start: pad(c.start), end: pad(c.end) })));
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  const patch = (key: number, change: Partial<Row>) =>
    setRows((r) => r?.map((x) => (x.key === key ? { ...x, ...change } : x)) ?? null);

  async function save() {
    if (!rows) return;
    const slots = [];
    for (const r of rows) {
      const start = timeToMin(r.start);
      const end = timeToMin(r.end);
      if (start === null || end === null) return setError("Use times like 09:30");
      slots.push({ day: r.day, start, end, label: r.label, room: r.room, course: r.course });
    }
    setSaving(true);
    const result = await saveSlots(slots);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    toast.success(`Added ${slots.length} ${slots.length === 1 ? "class" : "classes"}`);
    setRows(null);
    router.refresh();
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Timetable screenshot"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
        }}
      />
      <Button variant="tinted" block disabled={reading} onClick={() => input.current?.click()}>
        {reading ? <Loader2 className="animate-spin" /> : <ImageUp />}
        {reading ? "Reading your timetable…" : "Import from a screenshot"}
      </Button>

      <Sheet open={!!rows} onOpenChange={(o) => !o && setRows(null)}>
        <SheetContent>
          <SheetTitle className="text-xl font-bold">Check your classes</SheetTitle>
          <SheetDescription className="mb-4 text-sm text-sec">
            Read by AI from your screenshot. Fix anything it got wrong, then save. Only you see your
            timetable.
          </SheetDescription>
          <ul className="grid gap-3" aria-label="Classes found">
            {rows?.map((r, n) => (
              <li
                key={r.key}
                className="grid gap-2 rounded-card border border-sep bg-surface p-3"
                aria-label={`Class ${n + 1}`}
              >
                <div className="flex gap-2">
                  <Input
                    aria-label="Class name"
                    value={r.label}
                    maxLength={60}
                    onChange={(e) => patch(r.key, { label: e.target.value })}
                  />
                  <Button
                    size="icon"
                    variant="quiet"
                    aria-label={`Remove ${r.label}`}
                    onClick={() => setRows((all) => all?.filter((x) => x.key !== r.key) ?? null)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NativeSelect
                    aria-label="Day"
                    value={r.day}
                    onChange={(e) => patch(r.key, { day: Number(e.target.value) })}
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    aria-label="Starts"
                    type="time"
                    value={r.start}
                    onChange={(e) => patch(r.key, { start: e.target.value })}
                  />
                  <Input
                    aria-label="Ends"
                    type="time"
                    value={r.end}
                    onChange={(e) => patch(r.key, { end: e.target.value })}
                  />
                </div>
                <Input
                  aria-label="Room"
                  placeholder="Room (optional)"
                  value={r.room ?? ""}
                  maxLength={40}
                  onChange={(e) => patch(r.key, { room: e.target.value || null })}
                />
              </li>
            ))}
          </ul>
          {error && (
            <p id={`${id}-error`} role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            block
            className="mt-4"
            disabled={saving || !rows?.length}
            onClick={() => void save()}
          >
            {saving && <Loader2 className="animate-spin" />}
            Save {rows?.length ?? 0} {rows?.length === 1 ? "class" : "classes"}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
