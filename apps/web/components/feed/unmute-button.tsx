"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setMute } from "@/actions/feed";
import { Button } from "@/components/ui/button";

/** Me → Muted: unmute (and mute again, if that was a slip). */
export function UnmuteButton({ target, name }: { target: string; name: string }) {
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const result = await setMute(target, !muted);
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    setMuted(result.data);
  }

  return (
    <Button
      size="sm"
      variant={muted ? "tinted" : "quiet"}
      disabled={busy}
      onClick={toggle}
      aria-label={muted ? `Unmute ${name}` : `Mute ${name} again`}
    >
      {muted ? "Unmute" : "Mute again"}
    </Button>
  );
}
