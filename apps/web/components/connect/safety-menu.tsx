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

/**
 * Phase 4 task 6: Block and Report for a student (profile header, chat header). Blocking
 * hides you from each other everywhere and ends any connection; reports go to moderators.
 */
export function SafetyMenu({
  target,
  name,
  reportType = "profile",
  reportId,
  afterBlock = "/explore",
}: {
  target: string;
  name: string;
  reportType?: "profile" | "conversation";
  reportId?: string;
  afterBlock?: string;
}) {
  const id = useId();
  const router = useRouter();
  const [dialog, setDialog] = useState<"block" | "report" | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reported, setReported] = useState(false);

  async function confirmBlock() {
    setBusy(true);
    const result = await blockUser(target);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDialog(null);
    router.replace(afterBlock);
    router.refresh();
  }

  async function sendReport() {
    if (!reason) return setError("Choose a reason");
    setBusy(true);
    const result = await report({
      targetType: reportType,
      targetId: reportId ?? target,
      reason,
      details: details || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setReported(true);
  }

  const close = () => {
    setDialog(null);
    setError(undefined);
    setReported(false);
    setReason(null);
    setDetails("");
  };

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setDialog("report")}>
            <Flag /> Report
          </MenuItem>
          <MenuItem danger onSelect={() => setDialog("block")}>
            <Ban /> Block
          </MenuItem>
        </MenuContent>
      </Menu>

      <Dialog open={dialog === "block"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogTitle>Block {name}?</DialogTitle>
          <DialogDescription>
            You won&apos;t see each other anywhere on UOSBuddy, your connection ends, and they
            can&apos;t message you. They aren&apos;t told.
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={confirmBlock} disabled={busy}>
              Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "report"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogTitle>{reported ? "Thanks for telling us" : `Report ${name}`}</DialogTitle>
          {reported ? (
            <>
              <DialogDescription>
                A moderator will look at it. If you don&apos;t want to hear from them again, you can
                also block them.
              </DialogDescription>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="md" onClick={close}>
                  Done
                </Button>
                <Button variant="danger" size="md" onClick={() => setDialog("block")}>
                  Block
                </Button>
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
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2.5 has-[:checked]:border-brand"
                  >
                    <input
                      type="radio"
                      name={`${id}-reason`}
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-[var(--brand)]"
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
                <Button variant="ghost" size="md" onClick={close}>
                  Cancel
                </Button>
                <Button size="md" onClick={sendReport} disabled={busy}>
                  Send report
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
