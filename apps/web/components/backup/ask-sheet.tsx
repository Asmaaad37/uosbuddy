"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  CircleHelp,
  FileText,
  LifeBuoy,
  Loader2,
  Plus,
  ShoppingBag,
  Users,
} from "lucide-react";
import { createBackup } from "@/actions/backup";
import { Button } from "@/components/ui/button";
import { Card, Overline } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES, URGENCY_LABELS } from "@/lib/backup";
import { radioArrowKeys } from "@/lib/radio-keys";

type Category = (typeof CATEGORIES)[number];

/** The ask card's chips (redesign §5.3 #2), and the button label each one gives. */
const ASKS: Record<Category, { label: string; icon: React.ElementType; cta: string }> = {
  notes: { label: "Notes", icon: FileText, cta: "Ask for notes" },
  help: { label: "Explain a topic", icon: CircleHelp, cta: "Ask for an explanation" },
  ride: { label: "Ride", icon: Car, cta: "Ask for a ride" },
  company: { label: "Company", icon: Users, cta: "Ask for company" },
  item: { label: "Borrow something", icon: ShoppingBag, cta: "Ask to borrow something" },
  other: { label: "Something else", icon: Plus, cta: "Ask for backup" },
};

/**
 * Backup's ask card (redesign §5.3 #2): pick what you need, and the primary button says
 * so ("Ask for notes") and opens the request sheet with that choice filled in.
 */
export function AskCard({
  courses = [],
  department,
}: {
  courses?: { id: string; code: string; title: string }[];
  department: string | null;
}) {
  const [picked, setPicked] = useState<Category>("notes");
  const [open, setOpen] = useState(false);

  return (
    <Card className="grid gap-4">
      <div className="grid gap-3">
        <Overline id="ask-what">What do you need?</Overline>
        <div
          role="radiogroup"
          onKeyDown={radioArrowKeys}
          aria-labelledby="ask-what"
          className="flex flex-wrap gap-2"
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              role="radio"
              aria-checked={picked === c}
              selected={picked === c}
              icon={ASKS[c].icon}
              onClick={() => setPicked(c)}
            >
              {ASKS[c].label}
            </Chip>
          ))}
        </div>
      </div>
      {/* The screen's one orange action (60·30·10). */}
      <Button variant="cta" size="lg" block onClick={() => setOpen(true)}>
        <LifeBuoy aria-hidden /> {ASKS[picked].cta}
      </Button>
      <p className="-mt-1 text-center text-footnote text-sec">
        Goes to your course and section first, then the rest of {department ?? "your department"}.
      </p>
      <AskSheet key={picked} open={open} onOpenChange={setOpen} preset={picked} courses={courses} />
    </Card>
  );
}

/** Phase 5 task 4: the request sheet, opened from the ask card. */
function AskSheet({
  open,
  onOpenChange,
  preset,
  courses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: Category;
  courses: { id: string; code: string; title: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [category, setCategory] = useState<Category>(preset);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState(2);
  const [hours, setHours] = useState(24);
  const [course, setCourse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
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
    setTitle("");
    setDetails("");
    setError(undefined);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="text-title2">Ask for backup</SheetTitle>
        <SheetDescription className="mb-4 text-subhead text-sec">
          Your section and batch hear about it first. Up to 50 classmates get a ping.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <p className="text-subhead font-semibold">What do you need?</p>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              onKeyDown={radioArrowKeys}
              aria-label="Category"
            >
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  role="radio"
                  aria-checked={category === c}
                  selected={category === c}
                  icon={ASKS[c].icon}
                  onClick={() => setCategory(c)}
                >
                  {ASKS[c].label}
                </Chip>
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
            <p role="alert" className="text-subhead text-danger">
              {error}
            </p>
          )}
          <Button variant="cta" type="submit" block disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Send to my classmates
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
