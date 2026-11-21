import * as React from "react";
import { AIBuddyMascot, type BuddyMood } from "@/components/buddy/ai-buddy-mascot";
import { Card } from "./card";

/**
 * Empty state (redesign §3): inside a card, centred: a circular --raised well with a --sec
 * icon, an optional 17/600 title, a short --sec line and one action. Never an empty box.
 * `mascot` shows AIBuddy (decorative) instead of the icon, for the friendliest empty screens.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  bare = false,
  mascot,
}: {
  icon: React.ElementType;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Without the card (when it already sits inside one). */
  bare?: boolean;
  mascot?: BuddyMood;
}) {
  const body = (
    <div className="grid justify-items-center gap-3 px-2 py-6 text-center">
      {mascot ? (
        <AIBuddyMascot mood={mascot} size={84} title="" />
      ) : (
        <span className="grid size-[58px] place-items-center rounded-well bg-sky">
          <Icon className="size-6 text-accent" strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <div className="grid gap-1">
        {title && <p className="text-headline">{title}</p>}
        <p className="max-w-[270px] text-subhead text-sec">{children}</p>
      </div>
      {action}
    </div>
  );
  return bare ? <div className={className}>{body}</div> : <Card className={className}>{body}</Card>;
}
