"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { announceFeature } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Admin → Flags → Launches: tell everyone who tapped "Notify me" that AIBuddy is live.
 * Only enabled once AI is actually on; each student is told once.
 */
export function AnnounceLaunch({ pending, live }: { pending: number; live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const result = await announceFeature("aibuddy");
    setBusy(false);
    setOpen(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`Told ${result.data} ${result.data === 1 ? "student" : "students"}`);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" disabled={!live || pending === 0} onClick={() => setOpen(true)}>
        <Megaphone aria-hidden /> Tell {pending} waiting
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Announce AIBuddy?</DialogTitle>
          <DialogDescription className="text-subhead text-sec">
            {pending} {pending === 1 ? "student gets" : "students get"} a notification (and a push
            where it&apos;s on): &ldquo;AIBuddy is here&rdquo;. Each student is told once.
          </DialogDescription>
          <div className="mt-2 grid gap-2">
            <Button block onClick={send} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Send
            </Button>
            <Button block variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
