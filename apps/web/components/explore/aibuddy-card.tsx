"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { AIBuddyMascot } from "@/components/buddy/ai-buddy-mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const KEY = "uosbuddy-aibuddy-notify";

/**
 * AIBuddy teaser (redesign §5.1 #4). While AI is off, "Notify me" remembers the request
 * on this phone, and this card is where AIBuddy appears first once it's live. With AI on,
 * the whole card opens the chat.
 */
export function AIBuddyCard({ ready }: { ready: boolean }) {
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    try {
      setAsked(localStorage.getItem(KEY) === "1");
    } catch {
      // Private mode: the button just shows again.
    }
  }, []);

  function notify() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Ignore; the state still flips for this visit.
    }
    setAsked(true);
  }

  const body = (
    <div className="flex items-center gap-4">
      <AIBuddyMascot mood={asked ? "wink" : "idle"} size={76} title="" />
      <div className="grid min-w-0 flex-1 justify-items-start gap-1.5">
        <p className="flex items-center gap-2">
          <span className="text-headline">AIBuddy</span>
          {!ready && (
            <span className="rounded-pill bg-tint px-2 py-0.5 text-footnote font-semibold text-tint-text">
              Soon
            </span>
          )}
        </p>
        <p className="text-subhead text-sec">
          Ask about your courses. Answers come from your notes and past papers.
        </p>
        {!ready &&
          (asked ? (
            <p role="status" className="flex items-center gap-1 pt-1 text-subhead text-accent">
              <Check className="size-4" aria-hidden /> We&apos;ll show you here first
            </p>
          ) : (
            <Button size="sm" variant="quiet" onClick={notify} className="mt-1 bg-raised px-4">
              Notify me
            </Button>
          ))}
      </div>
    </div>
  );

  return ready ? (
    <Link href="/buddy" className="block rounded-card active:scale-[0.99]">
      <Card>{body}</Card>
    </Link>
  ) : (
    <Card>{body}</Card>
  );
}
