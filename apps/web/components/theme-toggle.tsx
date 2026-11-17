"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useAppearance, type Appearance } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { radioArrowKeys } from "@/lib/radio-keys";

const options: { value: Appearance; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "light", label: "Light theme", Icon: Sun },
];

/** A compact System / Dark / Light switch (Settings → Appearance uses the same provider). */
export function ThemeToggle({ className }: { className?: string }) {
  const { appearance: theme, setAppearance: choose } = useAppearance();

  return (
    <div
      role="radiogroup"
      onKeyDown={radioArrowKeys}
      aria-label="Theme"
      className={cn("inline-flex gap-1 rounded-track bg-track p-0.5", className)}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          onClick={() => choose(value)}
          className="grid size-11 place-items-center rounded-thumb text-sec transition-colors hover:text-label aria-checked:bg-thumb aria-checked:text-label aria-checked:shadow-[0_1px_3px_rgba(0,0,0,.18)]"
        >
          <Icon className="size-[18px]" aria-hidden />
        </button>
      ))}
    </div>
  );
}
