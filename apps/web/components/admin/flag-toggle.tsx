"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFlag } from "@/actions/trust";
import { toast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";

/** Phase 9 task 1: switch a feature flag on or off (audited). */
export function FlagToggle({
  flag,
  enabled,
  label,
}: {
  flag: string;
  enabled: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Switch
      aria-label={label}
      checked={enabled}
      disabled={pending}
      onChange={(e) => {
        const on = e.target.checked;
        start(async () => {
          const r = await setFlag(flag, on);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`${label} ${on ? "on" : "off"}`);
          router.refresh();
        });
      }}
    />
  );
}
