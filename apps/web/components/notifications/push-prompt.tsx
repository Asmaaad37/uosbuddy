"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { savePushSubscription } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

const DISMISSED = "uosb-push-prompt-dismissed";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

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
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      const result = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!result.ok) {
        setError(result.error);
        return setState("ask");
      }
      setState("on");
    } catch {
      setError("Couldn't turn on notifications in this browser.");
      setState("ask");
    }
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
      <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium">
        Notifications are on for this device.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="rounded-lg border border-line px-4 py-3 text-sm text-ink-2">
        Notifications are blocked for UOSBuddy in this browser. Allow them in the site settings to
        get pings.
      </p>
    );
  }
  return (
    <div className="relative grid gap-3 rounded-lg border border-brand/40 bg-surface p-4 pr-12">
      <button
        type="button"
        aria-label="Not now"
        onClick={dismiss}
        className="absolute top-2 right-2 grid size-9 place-items-center rounded-pill text-ink-2 hover:bg-surface-2"
      >
        <X className="size-4" />
      </button>
      <p className="flex items-start gap-2 font-semibold">
        <BellRing className="mt-0.5 size-5 shrink-0 text-brand" /> {reason}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="sm" className="justify-self-start" onClick={turnOn} disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="animate-spin" />} Turn on notifications
      </Button>
    </div>
  );
}
