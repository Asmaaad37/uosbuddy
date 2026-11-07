"use client";

import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setWaitlist } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

/** "Notify me when AIBuddy is ready": saved to your account; tap again to leave the list. */
export function BuddyNotifyButton({ waiting }: { waiting: boolean }) {
  const [on, setOn] = useState(waiting);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const result = await setWaitlist("aibuddy", !on);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    setOn(result.data);
  }

  return (
    <Button block variant={on ? "tinted" : "primary"} onClick={toggle} disabled={busy}>
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : on ? (
        <Check aria-hidden />
      ) : (
        <Bell aria-hidden />
      )}
      {on ? "You're on the list. We'll notify you" : "Notify me when it's ready"}
    </Button>
  );
}
