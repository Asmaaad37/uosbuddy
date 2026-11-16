"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HELP } from "@/lib/support";

/** Shown only to the writer, after a post or comment that mentions self-harm. */
export function SupportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>You&apos;re not alone</DialogTitle>
        <DialogDescription>
          If you&apos;re thinking about hurting yourself, please talk to someone now. You don&apos;t
          have to go through this by yourself.
        </DialogDescription>
        <ul className="grid gap-2 text-subhead">
          <li>
            In danger right now? Call <strong>{HELP.emergency}</strong>. In Punjab, 15 also offers
            mental-health counselling.
          </li>
          <li>
            Find a free helpline:{" "}
            <a
              href={HELP.directory}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent"
            >
              findahelpline.com
            </a>
          </li>
          <li>Tell someone you trust: a friend, someone in your family, or a teacher.</li>
        </ul>
        <Button block onClick={() => onOpenChange(false)}>
          Okay
        </Button>
      </DialogContent>
    </Dialog>
  );
}
