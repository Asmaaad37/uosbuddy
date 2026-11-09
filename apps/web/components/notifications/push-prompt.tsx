"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { subscribeThisDevice } from "@/components/notifications/push-client";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

const DISMISSED = "uosb-push-prompt-dismissed";

type State = "hidden" | "ask" | "busy" | "on" | "blocked";

/**
 * Phase 5 task 6: the soft ask. Shown after a meaningful action (not on page load), and
 * only asks the browser once the student taps "Turn on".
 */
export function PushPrompt({ reason }: { reason: string }) {
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState<string>();
  const key = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {
      // Private mode: just ask.
    }
    if (Notification.permission === "denied") return setState(dismissed ? "hidden" : "blocked");
    void navigator.serviceWorker.getRegistration().then(async (reg) => {
      const existing = await reg?.pushManager.getSubscription();
      if (existing && Notification.permission === "granted") return setState("hidden");
      if (!dismissed) setState("ask");
    });
  }, [key]);

  async function turnOn() {
    if (!key) return;
    setState("busy");
    setError(undefined);
    const result = await subscribeThisDevice(key);
    if (result.state === "error") {
      setError(result.error);
      return setState("ask");
    }
    setState(result.state);
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Ignore: it just shows again next time.
    }
    setState("hidden");
  }

  if (state === "hidden") return null;
  if (state === "on") {
    return (
      <p
        role="status"
        className="rounded-card bg-tint px-4 py-3 text-subhead font-medium text-tint-text"
      >
        Notifications are on for this device.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="rounded-card bg-surface px-4 py-3 text-subhead text-sec">
        Notifications are blocked for UOSBuddy in this browser. Allow them in the site settings to
        get pings.
      </p>
    );
  }
  return (
    <div className="relative grid gap-3 rounded-card bg-surface p-4 pr-12 shadow-card">
      <button
        type="button"
        aria-label="Not now"
        onClick={dismiss}
        className="absolute top-1 right-1 grid size-11 place-items-center rounded-pill text-ter active:bg-raised"
      >
        <X className="size-4" />
      </button>
      <p className="flex items-start gap-2 text-headline">
        <BellRing className="mt-0.5 size-5 shrink-0 text-accent" /> {reason}
      </p>
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
      <Button size="sm" className="justify-self-start" onClick={turnOn} disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="animate-spin" />} Turn on notifications
      </Button>
    </div>
  );
}
