"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./dialog";

// Sheets (redesign §1, §3, §6): always from the bottom, on the translucent --bar material,
// up to 560px wide and centred on larger screens. They spring up (bounce 0.2, 0.3 s), the
// page behind steps back to 96%, and dragging the top strip down dismisses them.
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

/** Past this distance (px) or speed (px/ms) a downward drag closes the sheet. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;

/** Drag the grab strip down to dismiss, with velocity handoff and a rubber band upwards. */
function useDragToDismiss(close: () => void) {
  const sheet = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);

  function set(dy: number, animate: boolean) {
    const el = sheet.current;
    if (!el) return;
    el.style.transition = animate ? "transform var(--spring-sheet-ms) var(--spring-sheet)" : "none";
    el.style.transform = dy ? `translateY(${dy}px)` : "";
  }

  return {
    sheet,
    handlers: {
      onPointerDown(e: React.PointerEvent) {
        drag.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp };
        (e.target as Element).setPointerCapture(e.pointerId);
      },
      onPointerMove(e: React.PointerEvent) {
        const d = drag.current;
        if (!d) return;
        const raw = e.clientY - d.y;
        // Downwards follows the finger; upwards resists (rubber band).
        set(raw >= 0 ? raw : -Math.sqrt(-raw) * 2, false);
        d.lastY = e.clientY;
        d.lastT = e.timeStamp;
      },
      onPointerUp(e: React.PointerEvent) {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        const dy = e.clientY - d.y;
        const v = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT);
        // The exit animation starts from where the finger let go.
        if (dy > DISMISS_DISTANCE || (dy > 10 && v > DISMISS_VELOCITY)) close();
        else set(0, true);
      },
      onPointerCancel() {
        drag.current = null;
        set(0, true);
      },
    },
  };
}

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const { sheet, handlers } = useDragToDismiss(() => closeRef.current?.click());

  // Scale the page behind around the middle of what's on screen, not the top of the page.
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--sheet-origin",
      `50% ${window.scrollY + window.innerHeight / 2}px`,
    );
  }, []);

  return (
    <SheetPrimitive.Portal>
      <DialogOverlay className="sheet-overlay" />
      <SheetPrimitive.Content
        ref={sheet}
        className={cn(
          "sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[22px] border-t border-bar-border bg-bar px-4 pb-[max(24px,env(safe-area-inset-bottom))] text-label backdrop-blur-[24px] backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-surface",
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          {...handlers}
          className="sticky top-0 z-10 -mx-4 mb-2 flex h-7 cursor-grab touch-none items-start justify-center pt-2 active:cursor-grabbing"
        >
          <span className="h-[5px] w-9 rounded-pill bg-ter/50" />
        </div>
        {children}
        <SheetPrimitive.Close ref={closeRef} className="sr-only" tabIndex={-1} aria-hidden>
          Close
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
