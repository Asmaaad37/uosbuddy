import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The screen's focal card (60·30·10): a Midnight surface with white text and two faint rings
 * in the corner. One per screen at most. Text on it uses `text-on-fill`, and secondary text
 * `text-on-fill/70` (both pass 4.5:1 on Midnight in light and dark).
 */
export function HeroCard({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[28px] bg-midnight p-5 text-on-fill shadow-card sm:p-6",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 -z-10 size-72 rounded-pill border border-on-fill/10"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-36 -z-10 size-72 rounded-pill border border-on-fill/10"
      />
      {children}
    </section>
  );
}
