"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./dialog";

// Bottom sheet on mobile (thumb zone), right-side panel from md up.
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
          "fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-lg border-t border-line bg-surface px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] text-ink shadow-lift",
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-t-none md:rounded-l-lg md:border-t-0 md:border-l md:px-6 md:pt-6",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-pill bg-line md:hidden" />
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
