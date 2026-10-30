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
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-surface p-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-lane-people text-lane-people-ink">
        <Users className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-semibold">{title}</span>
        <span className="text-[13px] text-ink-2">{error ?? hint}</span>
      </span>
      <Button size="sm" onClick={join} disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Join
      </Button>
    </div>
  );
}
