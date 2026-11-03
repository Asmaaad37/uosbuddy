"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { requestWomenOnly } from "@/actions/campus";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

/**
 * Phase 8 task 1: ask an admin to confirm access to women-only rides. Shown on Privacy;
 * the status says where the request is.
 */
export function WomenOnlyRequest({ status }: { status: string | null }) {
  const id = useId();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <section
      id="women-only"
      aria-labelledby={`${id}-h`}
      className="grid gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <h2 id={`${id}-h`} className="text-lg font-bold">
        Women-only spaces
      </h2>
      <p className="text-sm text-ink-2">
        Women students can see and join women-only rides. An admin confirms each request (they may
        check your verification details), so these spaces stay safe.
      </p>
      {status === "approved" ? (
        <p className="text-sm font-semibold text-success">You have access to women-only rides.</p>
      ) : status === "pending" ? (
        <p className="text-sm font-semibold">Your request is with an admin.</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestWomenOnly(note);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Request sent. You'll get a notification.");
              router.refresh();
            });
          }}
        >
          {status === "rejected" && (
            <p className="text-sm text-ink-2">
              Your last request wasn&apos;t approved. You can ask again a week after it.
            </p>
          )}
          <Field id={`${id}-note`} label="Note for the admin (optional)">
            {(aria) => (
              <Input
                {...aria}
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. I live in the girls' hostel"
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Ask for access
          </Button>
        </form>
      )}
    </section>
  );
}
