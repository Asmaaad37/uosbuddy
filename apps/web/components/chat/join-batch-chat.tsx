"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { joinBatchChat } from "@/actions/chat";
import { Button } from "@/components/ui/button";

/** A batch or section chat you haven't joined yet (joining is opt-in). */
export function JoinBatchChat({
  scope,
  title,
  hint,
}: {
  scope: "batch" | "section";
  title: string;
  hint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function join() {
    setBusy(true);
    const result = await joinBatchChat(scope);
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(`/chats/${result.data}`);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-[52px] shrink-0 place-items-center rounded-pill bg-tint text-accent">
        <Users className="size-6" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-headline">{title}</span>
        <span className={error ? "text-footnote text-danger" : "text-footnote text-ter"}>
          {error ?? hint}
        </span>
      </span>
      <Button size="sm" variant="tinted" onClick={join} disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Join
      </Button>
    </div>
  );
}
