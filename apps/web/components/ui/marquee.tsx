import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Marquee ticker (Section 6.3 #4). Content is duplicated for a seamless loop; the copy is
 * aria-hidden. Pauses on hover and stops entirely under prefers-reduced-motion (globals.css).
 */
export function Marquee({
  items,
  className,
  duration = 40,
}: {
  items: string[];
  className?: string;
  duration?: number;
}) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-4 pr-4 whitespace-nowrap">
          <span>{item}</span>
          <span aria-hidden className="text-brand">
            →
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "group overflow-hidden border-y border-line bg-surface py-2.5 font-pixel text-sm tracking-wide uppercase",
        className,
      )}
    >
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
