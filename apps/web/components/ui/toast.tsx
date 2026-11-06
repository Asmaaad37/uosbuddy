"use client";

import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/**
 * Toasts (redesign §3): --bar material, radius 16, above the tab bar, gone after 4 s. Pass
 * `action: { label: "Undo", onClick }` for anything undoable.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      duration={4000}
      offset={{ bottom: "calc(98px + env(safe-area-inset-bottom))" }}
      mobileOffset={{ bottom: "calc(98px + env(safe-area-inset-bottom))" }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[16px] !border !border-bar-border !bg-bar !text-label !shadow-lift !backdrop-blur-[24px] !backdrop-saturate-[180%] !font-sans !text-[15px] [@media(prefers-reduced-transparency:reduce)]:!bg-surface",
          description: "!text-sec",
          actionButton: "!rounded-field !bg-transparent !text-accent !font-semibold",
          success: "[&_[data-icon]]:!text-accent",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}
