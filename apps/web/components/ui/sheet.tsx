"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./dialog";

// Sheets (redesign §1, §3): always from the bottom, on the translucent --bar material,
// up to 560px wide and centred on larger screens.
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <DialogOverlay />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[22px] border-t border-bar-border bg-bar px-4 pt-2 pb-[max(24px,env(safe-area-inset-bottom))] text-label backdrop-blur-[24px] backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-surface",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mb-4 h-[5px] w-9 rounded-pill bg-ter/50" />
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
