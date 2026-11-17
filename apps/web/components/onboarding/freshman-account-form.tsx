"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CodeInput, ResendCode } from "@/components/auth/code-input";
import { toast } from "@/components/ui/toast";
import { useTurnstile } from "@/components/turnstile";
import { cn } from "@/lib/utils";
import { browserClient } from "@/lib/supabase/lazy";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  emailSchema,
  fullNameSchema,
  otpSchema,
  passwordSchema,
  passwordStrength,
} from "@/lib/validation/onboarding";

const STRENGTH = ["Too short", "Okay", "Good", "Strong", "Very strong"];

type Errors = Partial<Record<"name" | "email" | "password" | "code", string>>;

/** Fresher step 1: account with a personal email, confirmed by code (§3.3 B step 1). */
export function FreshmanAccountForm() {
  const id = useId();
  const [stage, setStage] = useState<"account" | "code">("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);
  const captcha = useTurnstile();

  async function createAccount(e: { preventDefault(): void }) {
    e.preventDefault();
    const n = fullNameSchema.safeParse(name);
    const m = emailSchema.safeParse(email);
    const p = passwordSchema.safeParse(password);
    const next: Errors = {
      name: n.success ? undefined : n.error.issues[0]?.message,
      email: m.success ? undefined : m.error.issues[0]?.message,
      password: p.success ? undefined : p.error.issues[0]?.message,
    };
    setErrors(next);
    if (!n.success || !m.success || !p.success) return;
    if (!captcha.ready) return setErrors({ email: "One moment: we're checking you're not a bot." });

    setBusy(true);
    const { data, error } = await (
      await browserClient()
    ).auth.signUp({
      email: m.data,
      password: p.data,
      options: {
        data: { full_name: n.data },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        captchaToken: captcha.token,
      },
    });
    setBusy(false);
    captcha.reset(); // tokens are single-use
    if (error) return setErrors({ email: authErrorMessage(error) });
    // Supabase hides existing accounts behind a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return setErrors({ email: "An account with this email already exists. Log in instead." });
    }
    if (data.session) return window.location.assign("/auth/continue");
    setEmail(m.data);
    setStage("code");
  }

  async function confirm(e: { preventDefault(): void }) {
    e.preventDefault();
    const c = otpSchema.safeParse(code);
    if (!c.success) return setErrors({ code: c.error.issues[0]?.message });

    setBusy(true);
    const { error } = await (
      await browserClient()
    ).auth.verifyOtp({ email, token: c.data, type: "signup" });
    if (error) {
      setBusy(false);
      return setErrors({ code: authErrorMessage(error) });
    }
    window.location.assign("/auth/continue");
  }

  async function resend() {
    const { error } = await (
      await browserClient()
    ).auth.resend({ type: "signup", email, options: { captchaToken: captcha.token } });
    captcha.reset();
    if (error) {
      toast.error(authErrorMessage(error));
      return false;
    }
    setCode("");
    toast.success("New code sent");
    return true;
  }

  const content =
    stage === "code" ? (
      <form onSubmit={confirm} className="grid gap-4" noValidate>
        <p className="text-sec">
          Enter the 6-digit code we sent to <strong className="text-label">{email}</strong> to
          confirm it&apos;s yours. Check spam if it doesn&apos;t arrive in a minute.
        </p>
        <Field id={`${id}-code`} label="Code" error={errors.code}>
          {(aria) => (
            <CodeInput {...aria} value={code} onChange={setCode} error={errors.code} autoFocus />
          )}
        </Field>
        <Button type="submit" block disabled={busy}>
          {busy ? "Checking…" : "Confirm email"}
        </Button>
        <ResendCode onResend={resend} disabled={!captcha.ready} />
      </form>
    ) : (
      <form onSubmit={createAccount} className="grid gap-4" noValidate>
        <Field
          id={`${id}-name`}
          label="Full name"
          hint="As it appears on your student card."
          error={errors.name}
        >
          {(aria) => (
            <Input
              {...aria}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
        </Field>
        <Field
          id={`${id}-email`}
          label="Personal email"
          hint="For your login and review updates. Never shown to anyone."
          error={errors.email}
        >
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
        <Field id={`${id}-password`} label="Password" error={errors.password}>
          {(aria) => (
            <div className="grid gap-2">
              <Input
                {...aria}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className="flex items-center gap-3" aria-live="polite">
                <div className="grid flex-1 grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 rounded-pill",
                        i <= strength ? (strength >= 3 ? "bg-fill" : "bg-danger") : "bg-sep",
                      )}
                    />
                  ))}
                </div>
                <span className="w-24 text-right text-footnote text-sec">
                  {password && STRENGTH[strength]}
                </span>
              </div>
            </div>
          )}
        </Field>
        <Button type="submit" block disabled={busy || !captcha.ready}>
          {busy ? "Creating account…" : "Continue"}
        </Button>
        <p className="text-center text-sm text-sec">
          Already joined?{" "}
          <Link href="/login" className="font-semibold text-accent">
            Log in
          </Link>
        </p>
      </form>
    );

  // Mounted across both steps: "Send a new code" needs a fresh token too.
  return (
    <div className="grid gap-4">
      {content}
      {captcha.widget}
    </div>
  );
}
