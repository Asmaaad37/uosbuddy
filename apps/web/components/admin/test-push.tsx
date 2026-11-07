"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendTestNotification } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

/** Admin → Launch check: send yourself a notification through the real push path. */
export function TestPush() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const result = await sendTestNotification();
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    toast.success("Sent. A push should arrive within a few seconds.");
    // Give pg_net a moment to record /api/push's answer, then show it.
    window.setTimeout(() => router.refresh(), 4000);
  }

  return (
    <Button size="sm" onClick={send} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />} Send me a
      test
    </Button>
  );
}
