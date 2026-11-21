import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Selectable chip (60·30·10): a 44px pill on Card with a soft lift and a Blue icon. Selected:
 * Midnight with white, heavier text, so the state isn't shown by colour alone. For static
 * labels use Pill (badge.tsx).
 */
export function Chip({
  selected = false,
  icon: Icon,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; icon?: React.ElementType }) {
  return (
    <button
      type="button"
      // A chip inside a radiogroup reports aria-checked instead.
      aria-pressed={props.role === "radio" ? undefined : selected}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill px-4 text-subhead whitespace-nowrap shadow-card transition-[transform,background-color,color] duration-100 ease-out active:scale-[0.97] contrast-more:border contrast-more:border-label",
        selected
          ? "bg-midnight font-semibold text-on-fill"
          : "bg-surface font-medium text-label hover:bg-raised",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={cn("size-4", !selected && "text-accent")} aria-hidden />}
      {children}
    </button>
  );
}
