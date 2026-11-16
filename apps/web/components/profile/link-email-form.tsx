"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CodeInput, ResendCode } from "@/components/auth/code-input";
import { confirmLinkEmail, startLinkEmail } from "@/actions/profile";

/** Phase 2 task 8: send a code to the UoS address, then confirm it. */
export function LinkEmailForm({ domain }: { domain: string }) {
  const id = useId();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: { preventDefault(): void }): Promise<boolean> {
    e?.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    const result = await startLinkEmail(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    if (stage === "code") setNotice("We sent a new code.");
    setCode("");
    setStage("code");
    return true;
  }

  async function confirm(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    const result = await confirmLinkEmail(code);
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    window.location.assign("/me");
  }

  if (stage === "code") {
    return (
      <form onSubmit={confirm} className="grid gap-4" noValidate>
        <p className="text-sec">
          We sent a 6-digit code to <strong className="text-label">{email}</strong>. It can take a
          minute, and may land in spam.
        </p>
        <Field id={`${id}-code`} label="Code" error={error}>
          {(aria) => (
            <CodeInput {...aria} value={code} onChange={setCode} error={error} autoFocus />
          )}
        </Field>
        {notice && (
          <p role="status" className="text-sm text-sec">
            {notice}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {busy ? "Checking…" : "Link email"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-accent"
            onClick={() => {
              setError(undefined);
              setNotice(undefined);
              setStage("email");
            }}
          >
            Change email
          </button>
          <ResendCode onResend={() => sendCode()} disabled={busy} />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="grid gap-4" noValidate>
      <Field
        id={`${id}-email`}
        label="UoS email"
        hint={`Your student address, ending in @${domain}. Only you see it.`}
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
            placeholder={`you@${domain}`}
          />
        )}
      </Field>
      <Button type="submit" block disabled={busy}>
        {busy ? "Sending…" : "Email me a code"}
      </Button>
    </form>
  );
}
