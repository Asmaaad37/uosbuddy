"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { blockUser, report } from "@/actions/connect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

const REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "fake", label: "Fake profile or not a UoS student" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;
type Reason = (typeof REASONS)[number]["value"];
export type ReportTarget =
  | "profile"
  | "message"
  | "conversation"
  | "post"
  | "comment"
  | "resource"
  | "listing"
  | "ride"
  | "event";

/** Phase 4 task 6: report a profile, message or chat. Only moderators see reports. */
export function ReportDialog({
  open,
  onOpenChange,
  title,
  targetType,
  targetId,
  onBlockInstead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  targetType: ReportTarget;
  targetId: string;
  onBlockInstead?: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  function close(next = false) {
    onOpenChange(next);
    if (!next) {
      setReason(null);
      setDetails("");
      setError(undefined);
      setSent(false);
    }
  }

  async function send() {
    if (!reason) return setError("Choose a reason");
    setBusy(true);
    const result = await report({ targetType, targetId, reason, details: details || undefined });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogTitle>{sent ? "Thanks for telling us" : title}</DialogTitle>
        {sent ? (
          <>
            <DialogDescription>
              A moderator will look at it.
              {onBlockInstead &&
                " If you don't want to hear from them again, you can also block them."}
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => close()}>
                Done
              </Button>
              {onBlockInstead && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    close();
                    onBlockInstead();
                  }}
                >
                  Block
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogDescription>
              Only moderators see reports. They aren&apos;t told who sent it.
            </DialogDescription>
            <div className="grid gap-2" role="radiogroup" aria-label="Reason">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-3 rounded-field border border-sep px-3 py-2.5 has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm font-medium">{r.label}</span>
                </label>
              ))}
            </div>
            <Field id={`${id}-details`} label="Anything else? (optional)">
              {(aria) => (
                <Textarea
                  {...aria}
                  value={details}
                  maxLength={1000}
                  onChange={(e) => setDetails(e.target.value)}
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => close()}>
                Cancel
              </Button>
              <Button size="md" onClick={send} disabled={busy}>
                Send report
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Confirm, then block: you disappear from each other everywhere and the connection ends. */
export function BlockDialog({
  open,
  onOpenChange,
  target,
  name,
  afterBlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: string;
  name: string;
  afterBlock: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setBusy(true);
    const result = await blockUser(target);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    router.replace(afterBlock);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Block {name}?</DialogTitle>
        <DialogDescription>
          You won&apos;t see each other anywhere on UOSBuddy, your connection ends, and they
          can&apos;t message you. They aren&apos;t told. You can unblock them from Me → Blocked.
        </DialogDescription>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="md" onClick={confirm} disabled={busy}>
            Block
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "More" menu with Report and Block (profiles, DM headers). `extra` adds items such as
 * Mute or Leave above them.
 */
export function SafetyMenu({
  target,
  name,
  reportType = "profile",
  reportId,
  afterBlock = "/explore",
  extra,
}: {
  target?: string;
  name: string;
  reportType?: ReportTarget;
  reportId?: string;
  afterBlock?: string;
  extra?: React.ReactNode;
}) {
  const [dialog, setDialog] = useState<"block" | "report" | null>(null);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          {extra}
          <MenuItem onSelect={() => setDialog("report")}>
            <Flag /> Report
          </MenuItem>
          {target && (
            <MenuItem danger onSelect={() => setDialog("block")}>
              <Ban /> Block
            </MenuItem>
          )}
        </MenuContent>
      </Menu>

      <ReportDialog
        open={dialog === "report"}
        onOpenChange={(o) => setDialog(o ? "report" : null)}
        title={`Report ${name}`}
        targetType={reportType}
        targetId={reportId ?? target ?? ""}
        onBlockInstead={target ? () => setDialog("block") : undefined}
      />
      {target && (
        <BlockDialog
          open={dialog === "block"}
          onOpenChange={(o) => setDialog(o ? "block" : null)}
          target={target}
          name={name}
          afterBlock={afterBlock}
        />
      )}
    </>
  );
}
