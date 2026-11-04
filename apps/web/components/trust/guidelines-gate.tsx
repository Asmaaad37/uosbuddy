"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { acceptGuidelines } from "@/actions/trust";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CONSEQUENCES, GUIDELINES } from "@/lib/guidelines";

/**
 * Phase 9 task 5: before a first post, comment or listing, the student accepts the
 * community guidelines. `ask()` resolves true once they've accepted (and it's saved).
 */
export function useGuidelinesGate() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setError(undefined);
        setOpen(true);
      }),
    [],
  );

  function close(ok: boolean) {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }

  async function accept() {
    setBusy(true);
    const r = await acceptGuidelines();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    close(true);
  }

  const gate = (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold">Before you post</DialogTitle>
        <DialogDescription className="text-sm text-ink-2">
          UOSBuddy works because everyone follows a few rules.
        </DialogDescription>
        <ul className="my-3 grid max-h-[50vh] gap-2.5 overflow-y-auto text-sm">
          {GUIDELINES.map((g) => (
            <li key={g.title}>
              <span className="font-semibold">{g.title}.</span> {g.body}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-2">
          {CONSEQUENCES}{" "}
          <Link href="/guidelines" target="_blank" className="font-semibold text-brand">
            Read the full guidelines
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button block disabled={busy} onClick={() => void accept()}>
            {busy && <Loader2 className="animate-spin" />} I agree
          </Button>
          <Button block variant="ghost" onClick={() => close(false)}>
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { gate, ask };
}
