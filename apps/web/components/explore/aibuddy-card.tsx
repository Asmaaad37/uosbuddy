"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setWaitlist } from "@/actions/notifications";
import { AIBuddyMascot } from "@/components/buddy/ai-buddy-mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * AIBuddy teaser (redesign §5.1 #4). While AI is off, "Notify me" puts you on the waitlist
 * (saved to your account), and you get a notification when an admin announces the launch.
 * With AI on, the whole card opens the chat.
 */
export function AIBuddyCard({ ready, waiting }: { ready: boolean; waiting: boolean }) {
  const [asked, setAsked] = useState(waiting);
  const [busy, setBusy] = useState(false);

  async function save(on: boolean) {
    setBusy(true);
    const result = await setWaitlist("aibuddy", on);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    setAsked(on);
    if (on) {
      toast("We'll notify you when AIBuddy is ready", {
        action: { label: "Undo", onClick: () => void save(false) },
      });
    }
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
              <Check className="size-4" aria-hidden /> You&apos;re on the list
            </p>
          ) : (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => save(true)}
              disabled={busy}
              className="mt-1 bg-raised px-4"
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
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
