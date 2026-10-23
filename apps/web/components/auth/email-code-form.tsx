"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { browserClient } from "@/lib/supabase/lazy";
import { authErrorMessage } from "@/lib/auth/errors";
import { emailDomain, emailSchema, otpSchema } from "@/lib/validation/onboarding";

/**
 * Two steps: email, then the code from the email. With `domains`, only those addresses are
 * accepted and a new account may be created (uni-email path); without, it only signs in.
 */
export function EmailCodeForm({
  domains,
  next,
  secondary,
}: {
  domains?: string[];
  next?: string;
  /** Use the secondary button style when a stronger option (Google) sits above. */
  secondary?: boolean;
}) {
  const id = useId();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [wrongDomain, setWrongDomain] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setError(undefined);
    setWrongDomain(false);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (domains && !domains.includes(emailDomain(parsed.data))) {
      setWrongDomain(true);
      return setError(`That's not a UoS email. It should end in @${domains[0]}.`);
    }

    setBusy(true);
    const { error } = await (
      await browserClient()
    ).auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: !!domains,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    // Sign-in mode: Supabase reports unknown emails; say it without confirming who has an account.
    if (error && error.code === "otp_disabled" && !domains) {
      return setError("We couldn't send a code to that email. Check it, or sign up first.");
    }
    if (error) return setError(authErrorMessage(error));
    setEmail(parsed.data);
    setStage("code");
  }

  async function verify(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);

    setBusy(true);
    const { error } = await (
      await browserClient()
    ).auth.verifyOtp({
      email,
      token: parsed.data,
      type: "email",
    });
    if (error) {
      setBusy(false);
      return setError(authErrorMessage(error));
    }
    // Full navigation so the middleware sees the new session cookie.
    window.location.assign(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  if (stage === "code") {
    return (
      <form onSubmit={verify} className="grid gap-4" noValidate>
        <p className="text-ink-2">
          We sent a code to <strong className="text-ink">{email}</strong>. It can take a minute, and
          may land in spam.
        </p>
        <Field id={`${id}-code`} label="Code" error={error}>
          {(aria) => (
            <Input
              {...aria}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              autoFocus
              className="text-center font-mono text-xl tracking-[0.4em]"
            />
          )}
        </Field>
        <Button type="submit" block disabled={busy}>
          {busy ? "Checking…" : "Continue"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => setStage("email")}
          >
            Change email
          </button>
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => sendCode()}
            disabled={busy}
          >
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="grid gap-4" noValidate>
      <Field
        id={`${id}-email`}
        label={domains ? "UoS email" : "Email"}
        hint={domains ? `Your student address, ending in @${domains[0]}.` : undefined}
        error={error}
      >
        {(aria) => (
          <Input
            {...aria}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder={domains ? `you@${domains[0]}` : "you@example.com"}
          />
        )}
      </Field>
      {wrongDomain && (
        <Link href="/start/freshman" className="text-sm font-semibold text-brand">
          Don&apos;t have a UoS email? Join with your student ID instead →
        </Link>
      )}
      <Button type="submit" block variant={secondary ? "secondary" : "primary"} disabled={busy}>
        {busy ? "Sending…" : "Email me a code"}
      </Button>
    </form>
  );
}
