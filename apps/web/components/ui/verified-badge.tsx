import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Verified student (redesign §3): a badge-check in --accent. Replaces the VERIFIED stamp. */
export function VerifiedBadge({ className, size = 18 }: { className?: string; size?: 16 | 18 }) {
  return (
    <BadgeCheck
      role="img"
      aria-label="Verified student"
      className={cn(
        "inline-block shrink-0 text-accent",
        size === 16 ? "size-4" : "size-[18px]",
        className,
      )}
      strokeWidth={2}
    />
  );
}
