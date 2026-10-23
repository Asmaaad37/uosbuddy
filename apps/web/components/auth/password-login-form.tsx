"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { browserClient } from "@/lib/supabase/lazy";
import { authErrorMessage } from "@/lib/auth/errors";
import { emailSchema } from "@/lib/validation/onboarding";

/** Email and password, for students who joined as freshers. */
export function PasswordLoginForm({ next }: { next?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || !password) return setError("Enter your email and password.");

    setBusy(true);
    const { error } = await (
      await browserClient()
    ).auth.signInWithPassword({
      email: parsed.data,
      password,
    });
    if (error) {
      setBusy(false);
      return setError(authErrorMessage(error));
    }
    window.location.assign(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field id={`${id}-email`} label="Email">
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
      <Field id={`${id}-password`} label="Password" error={error}>
        {(aria) => (
          <Input
            {...aria}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        )}
      </Field>
      <Button type="submit" block disabled={busy}>
        {busy ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
