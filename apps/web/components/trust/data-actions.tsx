"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2, Undo2 } from "lucide-react";
import { cancelDeletion, exportMyData, requestDeletion } from "@/actions/trust";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

/** Phase 9 task 6: download my data. */
export function ExportData() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  return (
    <div className="grid gap-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await exportMyData();
            if (!r.ok) return void toast.error(r.error);
            setResult(r.data);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Download />} Export my data
      </Button>
      {result && (
        <p className="text-sm" role="status">
          Ready.{" "}
          <a href={result.url} className="font-semibold text-accent" download>
            Download your data
          </a>{" "}
          (the link works for 7 days{result.emailed ? "; we've also emailed it to you" : ""}).
        </p>
      )}
    </div>
  );
}

/** Phase 9 task 6: delete my account, with 14 days to change my mind. */
export function DeleteAccount({ deletesAt }: { deletesAt: string | null }) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");

  if (deletesAt) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          Your account is deactivated and will be deleted for good on{" "}
          <strong>
            {new Date(deletesAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              timeZone: "Asia/Karachi",
            })}
          </strong>
          . Until then, other students can&apos;t see you.
        </p>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelDeletion();
              if (!r.ok) return void toast.error(r.error);
              toast.success("Welcome back! Your account is active again.");
              // A full load: the client router may still hold the earlier redirect to here.
              window.location.assign("/explore");
            })
          }
        >
          <Undo2 /> Keep my account
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestDeletion(confirm);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-sec">
        Your account is hidden straight away and deleted after 14 days: your profile, photo, private
        details, posts, listings and rides. Messages you sent stay in other people&apos;s chats
        without your name. Log in within 14 days to change your mind.
      </p>
      <Field id={`${id}-confirm`} label="Type DELETE to confirm">
        {(aria) => (
          <Input
            {...aria}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="danger"
        disabled={pending || confirm.trim().toUpperCase() !== "DELETE"}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete my account
      </Button>
    </form>
  );
}
