"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cancelBackup, claimBackup, resolveBackup, unclaimBackup } from "@/actions/backup";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";

type Kind = "claim" | "resolve" | "cancel" | "unclaim";

const LABELS: Record<Kind, string> = {
  claim: "I've got you",
  resolve: "Mark done",
  cancel: "Cancel",
  unclaim: "I can't help after all",
};

/** One lifecycle button for a Backup request. Claiming opens the temporary chat. */
export function BackupAction({ kind, request }: { kind: Kind; request: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [claimed, setClaimed] = useState(false);

  async function run() {
    if (kind === "cancel") {
      const ok = await confirm({
        title: "Cancel your request?",
        body: "Anyone helping will be told.",
        action: "Cancel request",
      });
      if (!ok) return;
    }
    if (kind === "unclaim") {
      const ok = await confirm({
        title: "Step back from this request?",
        body: "It opens again for others, and you won't be able to pick it up again.",
        action: "Step back",
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(undefined);
    if (kind === "claim") {
      const r = await claimBackup(request);
      if (!r.ok) {
        setBusy(false);
        return setError(r.error);
      }
      // Spec §6: the button becomes "You're on it ✓" once, with one success haptic, then
      // the chat opens.
      setClaimed(true);
      navigator.vibrate?.([12, 40, 12]);
      return void setTimeout(() => router.push(`/chats/${r.data}`), 650);
    }
    const fn = { resolve: resolveBackup, cancel: cancelBackup, unclaim: unclaimBackup }[kind];
    const r = await fn(request);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  if (claimed) {
    return (
      <span role="status" className="grid">
        <Button size="sm" variant="primary" disabled className="page-fade disabled:opacity-100">
          <Check aria-hidden className="tab-pop" /> You&apos;re on it
        </Button>
      </span>
    );
  }

  return (
    <span className="grid gap-1">
      <Button
        size="sm"
        variant={kind === "claim" ? "tinted" : kind === "resolve" ? "primary" : "plain"}
        onClick={run}
        disabled={busy}
      >
        {busy && <Loader2 className="animate-spin" />} {LABELS[kind]}
      </Button>
      {error && (
        <span role="alert" className="text-footnote text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
