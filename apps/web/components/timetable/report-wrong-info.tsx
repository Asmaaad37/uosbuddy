"use client";

import { useId, useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { reportTimetable } from "@/actions/official-timetable";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Kind = "room" | "time" | "teacher" | "cancelled" | "closed" | "other";

const CLASS_KINDS: { value: Kind; label: string }[] = [
  { value: "room", label: "Room" },
  { value: "time", label: "Time" },
  { value: "teacher", label: "Teacher" },
  { value: "cancelled", label: "Cancelled" },
  { value: "other", label: "Other" },
];
const ROOM_KINDS: { value: Kind; label: string }[] = [
  { value: "closed", label: "Closed or locked" },
  { value: "room", label: "Not free" },
  { value: "other", label: "Other" },
];

/**
 * Launch fix 4: "Report wrong info" on a class (entryId) or a room (roomId). The report lands
 * in the timetable editors' queue in /admin/timetable.
 */
export function ReportWrongInfo({
  entryId,
  roomId,
  label,
  className,
}: {
  entryId?: string;
  roomId?: string;
  /** What's being reported, for the button's accessible name ("Data Structures, Mon 10:30"). */
  label: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const kinds = entryId ? CLASS_KINDS : ROOM_KINDS;

  async function send() {
    if (!kind) return;
    setBusy(true);
    const r = await reportTimetable({ entryId, roomId, kind, note: note.trim() || undefined });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Thanks. An editor will check it.");
    setOpen(false);
    setKind(null);
    setNote("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Report wrong info: ${label}`}
        className={cn("hit shrink-0 self-start text-ter hover:text-label", className)}
      >
        <Flag className="size-4" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="text-xl font-bold">Report wrong info</SheetTitle>
          <SheetDescription className="mb-4 text-subhead text-sec">{label}</SheetDescription>
          <div className="grid gap-4">
            <div role="radiogroup" aria-label="What's wrong?" className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <Chip
                  key={k.value}
                  role="radio"
                  aria-checked={kind === k.value}
                  selected={kind === k.value}
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </Chip>
              ))}
            </div>
            <label htmlFor={`${id}-note`} className="grid gap-1.5 text-subhead font-semibold">
              What&apos;s right? (optional)
              <Textarea
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="It moved to CR-162 this week"
                className="font-normal"
              />
            </label>
            <Button variant="cta" block disabled={!kind || busy} onClick={send}>
              {busy && <Loader2 className="animate-spin" />} Send report
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
