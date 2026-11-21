import * as React from "react";
import { cn } from "@/lib/utils";

/** Card (redesign §3): --surface, radius 22, padding 16–20; no border or shadow in dark. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "card-in rounded-card bg-surface p-4 shadow-card contrast-more:border contrast-more:border-label sm:p-5",
        className,
      )}
      {...props}
    />
  );
}

/** A section heading (20/700) with an optional trailing link or note. */
export function SectionHeader({
  title,
  trailing,
  id,
  className,
}: {
  title: string;
  trailing?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-1", className)}>
      <h2 id={id} className="text-section">
        {title}
      </h2>
      {trailing && <div className="text-subhead text-accent">{trailing}</div>}
    </div>
  );
}

/** Overline label: 13/600, uppercase, --ter. */
export function Overline({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-overline text-ter uppercase", className)} {...props} />;
}
