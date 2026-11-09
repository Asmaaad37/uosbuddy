"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { forgetThisDevice, subscribeThisDevice } from "@/components/notifications/push-client";
import { Button } from "@/components/ui/button";
import { GroupedList, Row } from "@/components/ui/grouped-list";
import { publicEnv } from "@/lib/env";

type State = "loading" | "off" | "on" | "blocked" | "install" | "unsupported";

const SUBTITLE: Record<State, string> = {
  loading: "Checking…",
  off: "Off. Turn it on to get alerts here.",
  on: "On. Alerts arrive here even when the app is closed.",
  blocked: "Blocked. Allow notifications for UOSBuddy in this browser's site settings.",
  install: "On iPhone, add UOSBuddy to your Home Screen first, then open it from there.",
  unsupported: "This browser can't receive alerts.",
};

/**
 * Settings → Notifications: whether *this* browser gets pushes. Unlike the soft prompt it
 * can't be dismissed, so it's always possible to turn pushes on (or off) here. `endpoints`
 * are the browsers saved for this student: one saved for someone else doesn't count as on.
 */
export function PushDevice({ endpoints }: { endpoints: string[] }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const key = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
      return setState(ios ? "install" : "unsupported");
    }
    if (Notification.permission === "denied") return setState("blocked");
    void navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      const mine = !!sub && endpoints.includes(sub.endpoint);
      setState(mine && Notification.permission === "granted" ? "on" : "off");
    });
    // Only on arrival: after that, this component's own buttons keep the state right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function turnOn() {
    if (!key) return;
    setBusy(true);
    setError(undefined);
    const result = await subscribeThisDevice(key);
    setBusy(false);
    if (result.state === "error") return setError(result.error);
    setState(result.state);
  }

  async function turnOff() {
    setBusy(true);
    setError(undefined);
    try {
      await forgetThisDevice();
      setState("off");
    } catch {
      setError("Couldn't turn off notifications. Try again.");
    }
    setBusy(false);
  }

  if (!key) return null;

  return (
    <div className="grid gap-2">
      <GroupedList header="This device">
        <Row
          icon={BellRing}
          title="Alerts on this device"
          subtitle={SUBTITLE[state]}
          trailing={
            state === "off" ? (
              <Button size="sm" onClick={turnOn} disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />} Turn on
              </Button>
            ) : state === "on" ? (
              <Button size="sm" variant="tinted" onClick={turnOff} disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />} Turn off
              </Button>
            ) : undefined
          }
        />
      </GroupedList>
      {error && (
        <p role="alert" className="px-4 text-footnote text-danger">
          {error}
        </p>
      )}
      {state === "on" && (
        <p className="px-4 text-footnote text-ter">
          No sound? Your phone or computer decides that. Allow sound for UOSBuddy or your browser in
          its notification settings.
        </p>
      )}
    </div>
  );
}
