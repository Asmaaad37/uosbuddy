import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const lanes = {
  people: "bg-raised text-sec",
  learn: "bg-raised text-sec",
  help: "bg-raised text-sec",
  campus: "bg-raised text-sec",
} as const;

/**
 * Glossy, tactile app-icon tile with a pill label (Section 6.3 #2, Ref A). The spring
 * fan-out of preview cards is added with the Explore hub in Phase 3.
 */
export function FeatureTile({
  href,
  label,
  icon,
  lane,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  lane: keyof typeof lanes;
}) {
  return (
    <Link
      href={href}
      className="group flex w-20 flex-col items-center gap-2 rounded-field outline-offset-4"
    >
      <span
        className={cn(
          "relative grid size-16 place-items-center overflow-hidden rounded-[20px] shadow-card transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lift group-active:scale-[0.97] [&_svg]:size-7",
          lanes[lane],
        )}
      >
        {/* gloss */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-t-[16px] bg-gradient-to-b from-white/45 to-white/0"
        />
        {icon}
      </span>
      <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs font-semibold text-label shadow-card">
        {label}
      </span>
    </Link>
  );
}
