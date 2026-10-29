"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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

  async function sendCode(e?: { preventDefault(): void }) {
    e?.preventDefault();
    setError(undefined);
    setNotice(undefined);
    setBusy(true);
    const result = await startLinkEmail(email);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (stage === "code") setNotice("We sent a new code.");
    setCode("");
    setStage("code");
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
        <p className="text-ink-2">
          We sent a 6-digit code to <strong className="text-ink">{email}</strong>. It can take a
          minute, and may land in spam.
        </p>
        <Field id={`${id}-code`} label="Code" error={error}>
          {(aria) => (
            <Input
              {...aria}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="text-center font-mono text-xl tracking-[0.4em]"
            />
          )}
        </Field>
        {notice && (
          <p role="status" className="text-sm text-ink-2">
            {notice}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {busy ? "Checking…" : "Link email"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => {
              setError(undefined);
              setNotice(undefined);
              setStage("email");
            }}
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
