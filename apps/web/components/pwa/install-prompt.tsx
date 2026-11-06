"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

const KEY = "uob-install-dismissed";
const QUIET_DAYS = 30;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(KEY));
    return at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Phase 10 task 1: "Add to Home Screen". Android/Chrome get the browser's install prompt;
 * iPhone Safari (which has none) gets the two-step instructions. Hidden once installed,
 * and for 30 days after "Not now".
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || dismissedRecently()) return;

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (ios) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Private mode: it just shows again next time.
    }
    setMode(null);
  }

  if (!mode) return null;
  return (
    <aside
      aria-label="Install UOSBuddy"
      className="relative grid gap-2 rounded-card bg-surface p-4 pr-12 shadow-card"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute top-1 right-1 grid size-11 place-items-center rounded-pill text-ter active:bg-raised"
      >
        <X className="size-4" />
      </button>
      <p className="text-headline">Add UOSBuddy to your home screen</p>
      {mode === "ios" ? (
        <p className="text-subhead text-sec">
          Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> in Safari,
          then{" "}
          <span className="whitespace-nowrap">
            <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> Add to Home
            Screen
          </span>
          . It opens like an app, with notifications.
        </p>
      ) : (
        <>
          <p className="text-subhead text-sec">
            It opens like an app, uses less data, and can notify you.
          </p>
          <Button
            size="sm"
            className="justify-self-start"
            onClick={async () => {
              if (!event) return;
              await event.prompt();
              const { outcome } = await event.userChoice;
              if (outcome !== "accepted") dismiss();
              else setMode(null);
            }}
          >
            Install
          </Button>
        </>
      )}
    </aside>
  );
}
