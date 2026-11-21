"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, Loader2 } from "lucide-react";
import { createRide } from "@/actions/campus";
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
import { RIDE_AREAS, WEEKDAYS, addDays, fromPkLocal, pkLocalIn } from "@/lib/campus";
import { cn } from "@/lib/utils";
import { radioArrowKeys } from "@/lib/radio-keys";
import { Switch } from "@/components/ui/switch";

/** Areas to pick from, or type your own. */
export function AreaInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      {(aria) => (
        <>
          <Input
            {...aria}
            list={`${id}-areas`}
            value={value}
            maxLength={60}
            onChange={(e) => onChange(e.target.value)}
            placeholder="UoS main gate"
            autoComplete="off"
          />
          <datalist id={`${id}-areas`}>
            {RIDE_AREAS.flatMap((g) => g.areas).map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </>
      )}
    </Field>
  );
}

/** Phase 8 task 1: offer a lift or ask for one. */
export function RideSheet({ womenEligible }: { womenEligible: boolean }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"offer" | "request">("offer");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [when, setWhen] = useState(() => pkLocalIn(120));
  const [seats, setSeats] = useState(3);
  const [days, setDays] = useState<number[]>([]);
  // A recurring ride needs a last day; 8 weeks after the first ride unless changed.
  const [until, setUntil] = useState("");
  const firstDay = when.slice(0, 10);
  const lastDay = until || addDays(firstDay, 56);
  const [womenOnly, setWomenOnly] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const departAt = fromPkLocal(when);
    if (!departAt) return setError("Pick a day and time");
    setBusy(true);
    const result = await createRide({
      kind,
      from,
      to,
      departAt,
      seats: kind === "offer" ? seats : 1,
      recurring: days,
      until: days.length ? lastDay : undefined,
      womenOnly,
      notes: notes || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setFrom("");
    setTo("");
    setNotes("");
    setDays([]);
    setUntil("");
    setError(undefined);
    router.push("/rides?tab=mine");
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block variant="cta">
          <Car /> Offer or ask for a ride
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">New ride</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          Numbers stay hidden. You&apos;ll chat once you accept someone.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            onKeyDown={radioArrowKeys}
            aria-label="Offer or ask"
          >
            {(
              [
                ["offer", "I'm driving", "Offer seats"],
                ["request", "I need a lift", "Ask for a ride"],
              ] as const
            ).map(([k, title, sub]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "grid rounded-field border p-3 text-left",
                  kind === k ? "border-accent bg-tint" : "border-sep hover:border-sec/50",
                )}
              >
                <span className="font-semibold">{title}</span>
                <span className="text-xs text-sec">{sub}</span>
              </button>
            ))}
          </div>
          <AreaInput id={`${id}-from`} label="From" value={from} onChange={setFrom} />
          <AreaInput id={`${id}-to`} label="To" value={to} onChange={setTo} />
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-when`} label="Leaving">
              {(aria) => (
                <Input
                  {...aria}
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              )}
            </Field>
            {kind === "offer" && (
              <Field id={`${id}-seats`} label="Seats">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Repeats (optional)</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(i)}
                  onClick={() =>
                    setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))
                  }
                  className={cn(
                    "hit h-9 rounded-pill px-3 text-sm shadow-card",
                    days.includes(i)
                      ? "bg-midnight font-semibold text-on-fill"
                      : "bg-surface font-medium text-label",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            {days.length > 0 && (
              <Field id={`${id}-until`} label="Until">
                {(aria) => (
                  <Input
                    {...aria}
                    type="date"
                    value={lastDay}
                    min={firstDay}
                    max={addDays(firstDay, 120)}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                )}
              </Field>
            )}
          </fieldset>
          {womenEligible && (
            <label className="flex items-center justify-between gap-3 rounded-field border border-sep p-3">
              <span className="grid">
                <span className="font-semibold">Women only</span>
                <span className="text-footnote text-sec">
                  Only students confirmed for women-only spaces can see and join it.
                </span>
              </span>
              <Switch checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} />
            </label>
          )}
          <Field id={`${id}-notes`} label="Notes (optional)">
            {(aria) => (
              <Textarea
                {...aria}
                value={notes}
                maxLength={300}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Leaving after the 3 pm class, fare split 4 ways"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button variant="cta" type="submit" block disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Post ride
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
