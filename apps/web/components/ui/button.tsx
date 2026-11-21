import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons (redesign §3). Primary: --fill with white text. Tinted: --tint with --tintText.
 * Plain: transparent with --accent. Destructive: --danger text on --surface. Quiet: neutral
 * text for overflow and dismiss actions (blue is only for what acts). Every button scales
 * to 0.97 on pointer-down.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-btn font-semibold whitespace-nowrap transition-[transform,background-color,opacity] duration-100 ease-out select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Kinnow orange: the ONE most important action on a screen (60·30·10). Never two.
        cta: "bg-kinnow text-on-kinnow hover:brightness-105",
        // Midnight, white text: filled buttons that aren't the screen's one main action.
        primary: "bg-fill text-on-fill hover:brightness-110",
        tinted: "bg-tint text-tint-text hover:brightness-110",
        plain: "bg-transparent text-accent hover:bg-tint",
        destructive: "bg-surface text-danger hover:bg-raised",
        quiet: "bg-transparent text-label hover:bg-raised",
      },
      size: {
        lg: "h-[52px] px-6 text-headline",
        md: "h-12 px-5 text-headline",
        sm: "hit h-9 rounded-field px-3.5 text-subhead",
        xl: "h-[52px] px-6 text-headline",
        icon: "size-11 rounded-pill",
      },
      // Full-width buttons wrap long labels instead of widening the column.
      block: { true: "w-full min-w-0 shrink whitespace-normal text-center" },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

/** A 44px round toolbar button on --surface (bell, compose, back). `fill` = primary. */
export function IconButton({
  className,
  fill = false,
  cta = false,
  asChild,
  ...props
}: React.ComponentProps<"button"> & {
  fill?: boolean;
  /** Kinnow: the screen's one main action (Feed's compose). */
  cta?: boolean;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-pill transition-transform duration-100 ease-out active:scale-[0.97] [&_svg]:size-[22px]",
        cta
          ? "bg-kinnow text-on-kinnow hover:brightness-105"
          : fill
            ? "bg-fill text-on-fill"
            : "bg-surface text-label shadow-card hover:bg-raised",
        className,
      )}
      {...props}
    />
  );
}
