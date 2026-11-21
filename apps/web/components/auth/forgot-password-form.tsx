"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useTurnstile } from "@/components/turnstile";
import { browserClient } from "@/lib/supabase/lazy";
import { authErrorMessage } from "@/lib/auth/errors";
import { emailSchema } from "@/lib/validation/onboarding";

/** Sends the reset link. The reply is the same either way, so it never reveals who has an account. */
export function ForgotPasswordForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const captcha = useTurnstile();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (!captcha.ready) return setError("One moment: we're checking you're not a bot.");

    setBusy(true);
    const { error } = await (
      await browserClient()
    ).auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/confirm`,
      captchaToken: captcha.token,
    });
    setBusy(false);
    captcha.reset(); // tokens are single-use
    if (error) return setError(authErrorMessage(error));
    setSentTo(parsed.data);
  }

  if (sentTo) {
    return (
      <p role="status" className="rounded-field bg-raised p-4 text-subhead">
        If there&apos;s an account for <strong>{sentTo}</strong>, we&apos;ve sent it a link to
        choose a new password. Check your spam folder too.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field id={`${id}-email`} label="Email" error={error}>
        {(aria) => (
          <Input
            {...aria}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        )}
      </Field>
      {captcha.widget}
      <Button variant="cta" type="submit" block disabled={busy || !captcha.ready}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
