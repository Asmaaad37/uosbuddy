"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Segment = { value: string; label: string; href?: string };

/**
 * Segmented control (redesign §3): --track with 2px padding and radius 10; the --thumb
 * (radius 8, 32px) slides under the selected segment. Segments are equal width. Give each
 * segment an `href` to switch by URL (tabs), or use `onChange`.
 */
export function SegmentedControl({
  segments,
  value,
  onChange,
  label,
  className,
}: {
  segments: Segment[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
  className?: string;
}) {
  const index = Math.max(
    0,
    segments.findIndex((s) => s.value === value),
  );
  return (
    <div
      role={segments[0]?.href ? "navigation" : "radiogroup"}
      aria-label={label}
      className={cn("relative flex h-9 rounded-track bg-track p-0.5", className)}
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-thumb bg-thumb shadow-[0_1px_3px_rgba(0,0,0,.18)] transition-transform duration-(--spring-ms) ease-(--spring)"
        style={{
          width: `calc((100% - 4px) / ${segments.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {segments.map((s) => {
        const on = s.value === value;
        const cls = cn(
          "relative z-10 grid flex-1 place-items-center rounded-thumb text-footnote transition-colors",
          on ? "font-semibold text-label" : "font-medium text-sec hover:text-label",
        );
        return s.href ? (
          <Link key={s.value} href={s.href} aria-current={on ? "page" : undefined} className={cls}>
            {s.label}
          </Link>
        ) : (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange?.(s.value)}
            className={cls}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
