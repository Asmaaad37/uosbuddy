"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Avatar sizes (redesign §3): 36 composer/header, 40 rows and posts, 44 stacks, 52 chat
 * rows, 64 Me. The older keys (sm, md, lg, xl) map onto the scale.
 */
const sizes = {
  36: "size-9 text-footnote",
  40: "size-10 text-footnote",
  44: "size-11 text-subhead",
  52: "size-[52px] text-subhead",
  64: "size-16 text-headline",
  96: "size-24 text-title2",
  sm: "size-9 text-footnote",
  md: "size-11 text-subhead",
  lg: "size-16 text-headline",
  xl: "size-24 text-title2",
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * `src` is null when photo visibility hides the photo from this viewer; initials show
 * instead.
 */
export function Avatar({
  name,
  src,
  size = 40,
  onMidnight = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  /** On a Midnight hero: a solid white circle with Midnight initials (Sky is translucent in
   * dark mode, which loses contrast over Midnight). */
  onMidnight?: boolean;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-pill align-middle",
        onMidnight ? "bg-on-fill" : "bg-sky",
        sizes[size],
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className={cn(
          "grid size-full place-items-center font-bold",
          onMidnight ? "text-midnight" : "text-accent",
        )}
        aria-label={name}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/**
 * Overlapping avatars (−8px, a 3px ring in the surface colour), with dashed empty slots up
 * to `slots`: "your batch is filling up".
 */
export function AvatarStack({
  people,
  slots = 4,
  onMidnight = false,
  className,
}: {
  people: { name: string; src?: string | null }[];
  slots?: number;
  /** On a Midnight hero: rings and empty slots in Midnight and white instead of Card. */
  onMidnight?: boolean;
  className?: string;
}) {
  const shown = people.slice(0, slots);
  const empty = Math.max(0, slots - shown.length);
  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size={44}
          onMidnight={onMidnight}
          className={cn(
            "ring-[3px]",
            onMidnight ? "ring-midnight" : "ring-surface",
            i > 0 && "-ml-2",
          )}
        />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          key={`empty-${i}`}
          aria-hidden
          className={cn(
            onMidnight
              ? "size-11 rounded-pill border-[1.5px] border-dashed border-on-fill/45"
              : "size-11 rounded-pill border-[1.5px] border-dashed border-ter/60 bg-surface",
            (shown.length > 0 || i > 0) && "-ml-2",
          )}
        />
      ))}
    </div>
  );
}
