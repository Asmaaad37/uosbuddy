"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Loader2 } from "lucide-react";
import { createBackup } from "@/actions/backup";
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
import { CATEGORIES, CATEGORY_LABELS, URGENCY_LABELS } from "@/lib/backup";
import { cn } from "@/lib/utils";

type Category = (typeof CATEGORIES)[number];

/** Phase 5 task 4: the "I need backup" sheet. */
export function AskSheet({
  courses = [],
}: {
  courses?: { id: string; code: string; title: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState(2);
  const [hours, setHours] = useState(24);
  const [course, setCourse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!category) return setError("Pick a category");
    setBusy(true);
    const result = await createBackup({
      title,
      details,
      category,
      urgency,
      hours,
      course: course || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setTitle("");
    setDetails("");
    setCategory(null);
    setError(undefined);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block variant="brand">
          <LifeBuoy /> Ask for backup
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">Ask for backup</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-ink-2">
          Your section and batch hear about it first. Up to 50 classmates get a ping.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <p className="text-sm font-semibold">What do you need?</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex h-12 items-center justify-center gap-1.5 rounded-md border text-sm font-semibold",
                    category === c
                      ? "border-brand bg-brand/10"
                      : "border-line hover:border-ink-2/50",
                  )}
                >
                  <span aria-hidden>{CATEGORY_LABELS[c]!.emoji}</span> {CATEGORY_LABELS[c]!.label}
                </button>
              ))}
            </div>
          </div>
          <Field id={`${id}-title`} label="In a few words" hint={`${title.length}/100`}>
            {(aria) => (
              <Input
                {...aria}
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Need DSA notes from Monday's lecture"
              />
            )}
          </Field>
          <Field id={`${id}-details`} label="Details (optional)">
            {(aria) => (
              <Textarea
                {...aria}
                value={details}
                maxLength={1000}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Where, when, anything that helps"
              />
            )}
          </Field>
          {courses.length > 0 && (
            <Field
              id={`${id}-course`}
              label="For a course? (optional)"
              hint="Classmates taking it hear first"
            >
              {(aria) => (
                <NativeSelect {...aria} value={course} onChange={(e) => setCourse(e.target.value)}>
                  <option value="">Not about a course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-urgency`} label="How urgent?">
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={urgency}
                  onChange={(e) => setUrgency(Number(e.target.value))}
                >
                  {[1, 2, 3].map((u) => (
                    <option key={u} value={u}>
                      {URGENCY_LABELS[u]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id={`${id}-hours`} label="Open for">
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                >
                  <option value={3}>3 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>1 day</option>
                  <option value={48}>2 days</option>
                  <option value={72}>3 days</option>
                </NativeSelect>
              )}
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Send to my classmates
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
