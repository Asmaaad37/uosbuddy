"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { browserClient } from "@/lib/supabase/lazy";
import { authErrorMessage } from "@/lib/auth/errors";
import { passwordSchema } from "@/lib/validation/onboarding";

/** The email link signed them in; this sets the new password and ends every other session. */
export function ResetPasswordForm() {
  const id = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);

    setBusy(true);
    const supabase = await browserClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) {
      setBusy(false);
      return setError(authErrorMessage(error));
    }
    // If someone else got in, this is what puts them out.
    await supabase.auth.signOut({ scope: "others" });
    window.location.assign("/auth/continue");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field id={`${id}-password`} label="New password" hint="At least 8 characters." error={error}>
        {(aria) => (
          <Input
            {...aria}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        )}
      </Field>
      <Button variant="cta" type="submit" block disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
