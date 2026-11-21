"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveInterests } from "@/actions/setup";
import { OPENING_MOVES } from "@/lib/setup";
import { cn } from "@/lib/utils";

type Interest = { id: string; label: string; emoji: string; category: string };
type Prompt = (typeof OPENING_MOVES)[number] | "";

const MAX = 10;

/** Screen 8: up to 10 interest chips by category, plus one Opening Move. */
export function InterestsForm({
  interests,
  initial,
  next = "/setup/privacy",
  submitLabel = "Continue",
}: {
  /** Where to go after saving: the next setup step, or back to /me when editing. */
  next?: string;
  submitLabel?: string;
  interests: Interest[];
  initial: { selected: string[]; prompt: Prompt; answer: string };
}) {
  const id = useId();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial.selected);
  const [prompt, setPrompt] = useState<Prompt>(initial.prompt);
  const [answer, setAnswer] = useState(initial.answer);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const groups = new Map<string, Interest[]>();
    for (const i of interests) groups.set(i.category, [...(groups.get(i.category) ?? []), i]);
    return [...groups.entries()];
  }, [interests]);

  const full = selected.length >= MAX;

  function toggle(interestId: string) {
    setSelected((s) =>
      s.includes(interestId) ? s.filter((x) => x !== interestId) : full ? s : [...s, interestId],
    );
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    if (selected.length === 0) return setError("Pick at least one interest");
    if (prompt && !answer.trim()) return setError("Answer your Opening Move, or pick none");

    setBusy(true);
    const result = await saveInterests({ interestIds: selected, prompt, answer });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <div className="grid gap-5">
        <p className="text-sm font-semibold" aria-live="polite">
          {selected.length}/{MAX} picked
          {full && <span className="font-normal text-sec"> · remove one to pick another</span>}
        </p>
        {categories.map(([category, list]) => (
          <fieldset key={category} className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold tracking-[0.12em] text-sec uppercase">
              {category}
            </legend>
            <div className="flex flex-wrap gap-2">
              {list.map((i) => {
                const on = selected.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() => toggle(i.id)}
                    className={cn(
                      "inline-flex h-11 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition-colors",
                      on
                        ? "border-accent bg-tint text-tint-text"
                        : "border-sep bg-surface hover:shadow-lift disabled:opacity-40",
                    )}
                  >
                    <span aria-hidden>{i.emoji}</span>
                    {i.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="grid gap-3 rounded-card bg-surface p-4 shadow-card contrast-more:border contrast-more:border-label">
        <div>
          <p className="font-bold">Your Opening Move (optional)</p>
          <p className="text-sm text-sec">
            Batchmates can reply to it when they connect, so saying hi isn&apos;t awkward.
          </p>
        </div>
        <Field id={`${id}-prompt`} label="Prompt">
          {(aria) => (
            <NativeSelect
              {...aria}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value as Prompt)}
            >
              <option value="">No Opening Move</option>
              {OPENING_MOVES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        {prompt && (
          <Field id={`${id}-answer`} label="Your answer" hint={`${answer.length}/200`}>
            {(aria) => (
              <Textarea
                {...aria}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                maxLength={200}
                className="min-h-20"
              />
            )}
          </Field>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button variant="cta" type="submit" block disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
