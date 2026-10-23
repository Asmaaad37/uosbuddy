import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pill buttons (Section 6.3 #3): ink-filled primary, outlined secondary, 48px on mobile, 0.97 press.
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[transform,background-color,box-shadow,opacity] duration-200 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-bg hover:opacity-90",
        brand: "bg-brand text-brand-ink hover:opacity-90",
        secondary: "border-[1.5px] border-ink/80 bg-transparent text-ink hover:bg-ink/5",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        lg: "h-12 px-6 text-base",
        md: "h-11 px-5 text-[15px]",
        sm: "h-9 px-4 text-sm",
        icon: "size-11",
      },
      block: { true: "w-full" },
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
