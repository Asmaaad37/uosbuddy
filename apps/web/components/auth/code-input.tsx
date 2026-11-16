"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CODE_LENGTH } from "@/lib/validation/onboarding";

/**
 * A 6-digit code shown as six boxes. Underneath it's one ordinary input, so typing, pasting,
 * the phone's "from Messages/Mail" suggestion and screen readers all work as usual. Digits pop
 * in; a wrong code (a new `error`) shakes the row.
 */
export function CodeInput({
  value,
  onChange,
  error,
  autoFocus,
  ...aria
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}) {
  const [focused, setFocused] = useState(false);
  const [shakes, setShakes] = useState(0);
  const [lastError, setLastError] = useState(error);

  // Shake once each time a new error arrives.
  if (error !== lastError) {
    setLastError(error);
    if (error) setShakes((n) => n + 1);
  }

  const digits = value.split("");
  const active = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className="relative">
      <input
        {...aria}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        // No maxLength: a pasted "123 456" or "Code: 123456" must reach the filter whole.
        autoFocus={autoFocus}
        // The real input sits over the boxes, invisible, so taps and long-press paste land on it.
        className="absolute inset-0 z-10 h-full w-full cursor-text text-transparent caret-transparent opacity-0"
      />
      <div
        key={shakes}
        aria-hidden
        className={cn("grid grid-cols-6 gap-2", shakes > 0 && "code-shake")}
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = digits[i];
          const current = focused && i === active && value.length < CODE_LENGTH;
          return (
            <div
              key={i}
              className={cn(
                "grid h-14 place-items-center rounded-field border-2 bg-surface font-mono text-2xl font-semibold tabular-nums transition-colors",
                error
                  ? "border-danger"
                  : current
                    ? "border-accent"
                    : digit
                      ? "border-sep"
                      : "border-sep/60",
              )}
            >
              {digit ? (
                <span key={`${i}-${digit}`} className="code-pop">
                  {digit}
                </span>
              ) : current ? (
                <span className="h-7 w-0.5 animate-pulse rounded-full bg-accent" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Resend code in 0:42", then a "Resend code" link. Starts counting when it appears (a code
 * was just sent) and again after each resend. Supabase allows one code a minute per address.
 */
export function ResendCode({
  onResend,
  disabled,
  seconds = 60,
}: {
  /** Sends a new code; resolve true if it went, to restart the countdown. */
  onResend: () => Promise<boolean>;
  disabled?: boolean;
  seconds?: number;
}) {
  const [until, setUntil] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left]);

  if (left > 0) {
    return (
      <p className="text-sm text-sec tabular-nums">
        Resend code in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </p>
    );
  }
  return (
    <button
      type="button"
      className="justify-self-start text-sm font-semibold text-accent disabled:opacity-50"
      disabled={disabled || sending}
      onClick={async () => {
        setSending(true);
        const sent = await onResend();
        setSending(false);
        if (sent) {
          setUntil(Date.now() + seconds * 1000);
          setNow(Date.now());
        }
      }}
    >
      {sending ? "Sending…" : "Resend code"}
    </button>
  );
}
