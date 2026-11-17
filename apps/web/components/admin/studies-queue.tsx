"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { DocViewer } from "@/components/admin/doc-viewer";
import { decideStudiesChange } from "@/actions/admin";

export type StudiesItem = {
  id: string;
  name: string;
  docPath: string;
  docUrl: string | null;
  changes: { label: string; from: string; to: string }[];
};

/** One card per request: the proof, what would change, and approve or reject. */
export function StudiesQueue({ items }: { items: StudiesItem[] }) {
  if (!items.length) {
    return (
      <div className="grid h-56 place-items-center rounded-card bg-surface text-center shadow-card">
        <p className="text-lg font-bold">Nothing waiting</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      {items.map((item) => (
        <Request key={item.id} item={item} />
      ))}
    </div>
  );
}

function Request({ item }: { item: StudiesItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const decide = (approve: boolean) =>
    start(async () => {
      const result = await decideStudiesChange({
        requestId: item.id,
        approve,
        reason: approve ? undefined : reason,
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success(approve ? `${item.name}'s studies were updated` : `${item.name} was told why`);
      router.refresh();
    });

  return (
    <section
      aria-label={item.name}
      className="grid gap-5 rounded-card border border-sep bg-surface p-4 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      <DocViewer url={item.docUrl} path={item.docPath} />
      <div className="grid content-start gap-4">
        <h2 className="font-bold">{item.name}</h2>
        <dl className="grid gap-3">
          {item.changes.map((c) => (
            <div key={c.label}>
              <dt className="text-footnote text-sec">{c.label}</dt>
              {c.from === c.to ? (
                <dd>{c.to}</dd>
              ) : (
                <dd className="font-semibold">
                  {c.from} → {c.to}
                </dd>
              )}
            </div>
          ))}
        </dl>
        {rejecting ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              decide(false);
            }}
          >
            <Textarea
              aria-label="Reason sent to the student"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="The student sees this in the app."
            />
            <div className="flex gap-2">
              <Button type="button" variant="quiet" size="md" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="md"
                variant="destructive"
                disabled={pending || !reason.trim()}
                className="flex-1"
              >
                Reject
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-2">
            <Button block disabled={pending} onClick={() => decide(true)}>
              <Check /> Approve
            </Button>
            <Button
              variant="tinted"
              size="md"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              <X /> Reject
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
