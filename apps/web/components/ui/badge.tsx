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

// Profile stamps: UOS EMAIL, MENTOR, BACKUP HERO (VERIFIED becomes the badge-check icon).
const stampVariants = cva(
  "inline-flex h-6 items-center rounded-pill px-2 text-footnote font-semibold",
  {
    variants: {
      tone: {
        verified: "bg-tint text-tint-text",
        email: "bg-raised text-sec",
        mentor: "bg-raised text-sec",
        hero: "bg-tint text-tint-text",
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
