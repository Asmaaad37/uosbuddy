"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setWaitlist } from "@/actions/notifications";
import { AIBuddyMascot } from "@/components/buddy/ai-buddy-mascot";
import { cn } from "@/lib/utils";

const card =
  "flex w-full items-center gap-3 rounded-card bg-surface p-4 text-left shadow-card transition-transform duration-100 ease-out active:scale-[0.98] contrast-more:border contrast-more:border-label";

/**
 * AIBuddy (explore-v2): one slim card. While AI is off, tapping it puts you on the waitlist
 * at once (an Undo toast takes it back), and the pill says so. With AI on, it opens the chat.
 */
export function AIBuddyCard({ ready, waiting }: { ready: boolean; waiting: boolean }) {
  const [asked, setAsked] = useState(waiting);

  async function save(on: boolean) {
    setAsked(on); // Optimistic: the pill changes on tap.
    const result = await setWaitlist("aibuddy", on);
    if (!result.ok) {
      setAsked(!on);
      return void toast.error(result.error);
    }
    if (on) {
      toast("We'll tell you when AIBuddy is ready", {
        action: { label: "Undo", onClick: () => void save(false) },
      });
    }
  }

  const body = (
    <>
      <AIBuddyMascot mood={asked ? "wink" : "idle"} size={52} title="" />
      <span className="grid min-w-0 flex-1">
        <span className="text-headline font-bold">Ask AIBuddy</span>
        <span className="text-subhead text-sec">Your course notes, answered</span>
      </span>
      {!ready && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-footnote font-bold",
            asked ? "bg-midnight text-on-fill" : "bg-sky text-accent",
          )}
        >
          {asked && <Check className="size-3.5" aria-hidden />}
          {asked ? "On the list" : "Soon"}
        </span>
      )}
    </>
  );

  if (ready) {
    return (
      <Link href="/buddy" className={card}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={card}
      disabled={asked}
      aria-label={asked ? "AIBuddy: you're on the list" : "AIBuddy is coming soon. Notify me"}
      onClick={() => save(true)}
    >
      {body}
    </button>
  );
}
