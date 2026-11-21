import * as React from "react";
import { Card } from "./card";

/**
 * Empty state (redesign §3): inside a card, centred: a circular --raised well with a --sec
 * icon, an optional 17/600 title, a short --sec line and one action. Never an empty box.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  bare = false,
}: {
  icon: React.ElementType;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Without the card (when it already sits inside one). */
  bare?: boolean;
}) {
  const body = (
    <div className="grid justify-items-center gap-3 px-2 py-6 text-center">
      <span className="grid size-[58px] place-items-center rounded-well bg-sky">
        <Icon className="size-6 text-accent" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="grid gap-1">
        {title && <p className="text-headline">{title}</p>}
        <p className="max-w-[270px] text-subhead text-sec">{children}</p>
      </div>
      {action}
    </div>
  );
  return bare ? <div className={className}>{body}</div> : <Card className={className}>{body}</Card>;
}
