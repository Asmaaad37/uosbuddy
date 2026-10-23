import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Chips: interests, reason chips ("Same section"), filters.
const chipVariants = cva(
  "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink",
        outline: "border border-line text-ink",
        brand: "bg-brand/12 text-brand",
        people: "bg-lane-people text-lane-people-ink",
        learn: "bg-lane-learn text-lane-learn-ink",
        help: "bg-lane-help text-lane-help-ink",
        campus: "bg-lane-campus text-lane-campus-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Chip({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}

// Pixel-font stamps (Section 6.3 #7): VERIFIED, UOS EMAIL, MENTOR, BACKUP HERO.
const stampVariants = cva(
  "inline-flex h-6 -rotate-2 items-center rounded-[4px] border-2 px-1.5 font-pixel text-[11px] leading-none tracking-wider uppercase",
  {
    variants: {
      tone: {
        verified: "border-brand text-brand",
        email: "border-lane-people text-lane-people dark:border-brand-soft dark:text-brand-soft",
        mentor: "border-success text-success",
        hero: "border-transparent bg-lane-help text-lane-help-ink",
      },
    },
    defaultVariants: { tone: "verified" },
  },
);

export function Stamp({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof stampVariants>) {
  return <span className={cn(stampVariants({ tone }), className)} {...props} />;
}
