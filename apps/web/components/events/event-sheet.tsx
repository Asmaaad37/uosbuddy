"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { createEvent } from "@/actions/campus";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fromPkLocal, pkLocalIn } from "@/lib/campus";

/**
 * Phase 8 task 3: post an event for a society you run (admins can also post campus-wide).
 */
export function EventSheet({
  societies,
  campusWide = false,
}: {
  societies: { id: string; name: string }[];
  campusWide?: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [society, setSociety] = useState(societies[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [starts, setStarts] = useState(() => pkLocalIn(24 * 60));
  const [ends, setEnds] = useState(() => pkLocalIn(26 * 60));
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const startsAt = fromPkLocal(starts);
    const endsAt = fromPkLocal(ends);
    if (!startsAt || !endsAt) return setError("Pick when it starts and ends");
    const cap = capacity.trim() ? Number(capacity) : undefined;
    if (cap !== undefined && !Number.isInteger(cap)) return setError("Capacity is a number");
    setBusy(true);
    const result = await createEvent({
      society: society || undefined,
      title,
      description,
      startsAt,
      endsAt,
      venue,
      capacity: cap,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setTitle("");
    setDescription("");
    setVenue("");
    setCapacity("");
    setError(undefined);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block variant="primary">
          <CalendarPlus /> Post an event
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">New event</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          Everyone at UoS can see it. Students going get a reminder an hour before.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {(societies.length > 1 || campusWide) && (
            <Field id={`${id}-society`} label="Posted by">
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={society}
                  onChange={(e) => setSociety(e.target.value)}
                >
                  {societies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {campusWide && <option value="">UOSBuddy (campus-wide)</option>}
                </NativeSelect>
              )}
            </Field>
          )}
          <Field id={`${id}-title`} label="Event name">
            {(aria) => (
              <Input
                {...aria}
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inter-department debate"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-starts`} label="Starts">
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                />
              )}
            </Field>
            <Field id={`${id}-ends`} label="Ends">
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  value={ends}
                  onChange={(e) => setEnds(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field id={`${id}-venue`} label="Venue">
              {(aria) => (
                <Input
                  {...aria}
                  value={venue}
                  maxLength={100}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Main auditorium"
                />
              )}
            </Field>
            <Field id={`${id}-capacity`} label="Capacity">
              {(aria) => (
                <Input
                  {...aria}
                  inputMode="numeric"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Any"
                />
              )}
            </Field>
          </div>
          <Field id={`${id}-description`} label="About (optional)">
            {(aria) => (
              <Textarea
                {...aria}
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button variant="cta" type="submit" block disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Post event
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
