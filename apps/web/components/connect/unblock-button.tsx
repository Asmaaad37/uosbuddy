"use client";

import { useState } from "react";
import { unblockUser } from "@/actions/connect";
import { Button } from "@/components/ui/button";

export function UnblockButton({ target }: { target: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <span className="text-sm text-sec">Unblocked</span>;
  return (
    <Button
      size="sm"
      variant="tinted"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await unblockUser(target);
        setBusy(false);
        if (result.ok) setDone(true);
      }}
    >
      Unblock
    </Button>
  );
}
