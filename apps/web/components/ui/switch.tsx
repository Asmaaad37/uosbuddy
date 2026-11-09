import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * An on/off switch: a native checkbox (so forms, keyboards and screen readers just work)
 * drawn as a switch. Off uses --ter so the track stays visible against the card (3:1).
 */
export function Switch({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 cursor-pointer appearance-none rounded-pill bg-ter transition-colors checked:bg-fill disabled:cursor-default disabled:opacity-50",
        "before:absolute before:top-[2px] before:left-[2px] before:size-[27px] before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:before:translate-x-5 motion-reduce:before:transition-none",
        className,
      )}
      {...props}
    />
  );
}
