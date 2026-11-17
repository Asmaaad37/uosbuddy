import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pills: static labels (interests, reasons like "Same section", statuses). Selectable
// filter chips are Chip in chip.tsx. Colour stays quiet: neutral, or tinted for emphasis.
const pillVariants = cva(
  "inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-footnote font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-raised text-sec",
        outline: "border border-sep text-sec",
        brand: "bg-tint text-tint-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Pill({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof pillVariants>) {
  return <span className={cn(pillVariants({ tone }), className)} {...props} />;
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
