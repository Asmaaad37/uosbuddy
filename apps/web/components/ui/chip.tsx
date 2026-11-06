import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Selectable chip (redesign §3): 36px, 1px --sep border, transparent. Selected: --accent
 * border, --tint background, --tintText text. For static labels use Pill (badge.tsx).
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
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border px-3.5 text-subhead font-medium whitespace-nowrap transition-[transform,background-color,border-color] duration-100 ease-out active:scale-[0.97]",
        selected
          ? "border-accent bg-tint text-tint-text"
          : "border-sep bg-transparent text-label hover:bg-raised",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
}
