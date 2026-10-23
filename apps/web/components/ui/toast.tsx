"use client";

import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-line !bg-surface !text-ink !shadow-lift !font-sans !text-[15px]",
          description: "!text-ink-2",
          actionButton: "!rounded-pill !bg-ink !text-bg !font-semibold",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}
