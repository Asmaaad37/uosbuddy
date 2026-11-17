"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useTurnstile } from "@/components/turnstile";
import { joinWaitlist } from "@/actions/onboarding";

/** "Not from UoS? Request your university" waitlist (Section 7, screen 2). */
export function WaitlistDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="quiet" block>
          Not from UoS? Request your university
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Request your university</DialogTitle>
        <DialogDescription>
          Tell us which university you&apos;re at. We&apos;ll email you once when it&apos;s live,
          and never otherwise.
        </DialogDescription>
        <WaitlistForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Its own component so the security check starts when the dialog opens: started with the
 * dialog closed, it had nowhere to render and the button never enabled.
 */
function WaitlistForm({ onDone }: { onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const captcha = useTurnstile();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const result = await joinWaitlist({ name, email, captchaToken: captcha.token });
    setBusy(false);
    captcha.reset(); // tokens are single-use
    if (!result.ok) return setError(result.error);
    onDone();
    toast.success("You're on the list", {
      description: "We'll email you when we reach your university.",
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field id={`${id}-uni`} label="University">
        {(aria) => (
          <Input
            {...aria}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. University of the Punjab"
          />
        )}
      </Field>
      <Field id={`${id}-email`} label="Your email" error={error}>
        {(aria) => (
          <Input
            {...aria}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      {captcha.widget}
      <Button type="submit" block disabled={busy || !captcha.ready}>
        {busy ? "Saving…" : "Notify me"}
      </Button>
    </form>
  );
}
