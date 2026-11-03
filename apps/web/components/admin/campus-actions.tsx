"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { decideWomenOnly, verifySociety } from "@/actions/campus";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Approve / decline buttons for the campus admin queues (Phase 8). */
export function CampusDecision({
  kind,
  target,
  name,
}: {
  kind: "women-only" | "society";
  target: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const decide = (yes: boolean) =>
    start(async () => {
      const r =
        kind === "women-only"
          ? await decideWomenOnly(target, yes)
          : await verifySociety(target, yes);
      if (!r.ok) return void toast.error(r.error);
      toast.success(yes ? `${name} approved` : `${name} declined`);
      router.refresh();
    });
  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => decide(true)}
        aria-label={`Approve ${name}`}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />} Approve
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => decide(false)}
        aria-label={`Decline ${name}`}
      >
        <X /> Decline
      </Button>
    </div>
  );
}
