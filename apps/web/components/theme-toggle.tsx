"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
const KEY = "uosbuddy-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved) {
        setTheme(saved);
        apply(saved);
      }
    } catch {
      // Storage unavailable (private mode): fall back to the system theme.
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex gap-1 rounded-pill bg-surface-2 p-1", className)}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          onClick={() => choose(value)}
          className="grid size-11 place-items-center rounded-pill text-ink-2 transition-colors hover:text-ink aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-card"
        >
          <Icon className="size-[18px]" aria-hidden />
        </button>
      ))}
    </div>
  );
}
