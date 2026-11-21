import Link from "next/link";
import { cn } from "@/lib/utils";

type Chip = { value: string; label: string; count?: number; href?: string };

/**
 * A scrolling row of filter chips, for lists with more options than fit a segmented
 * control (market kinds, directory scopes, file types). Give chips an `href` to filter by
 * URL, or use `onChange`. Sections of a screen use SegmentedControl instead.
 */
export function FilterChips({
  chips,
  value,
  onChange,
  label,
}: {
  chips: Chip[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // py-1 leaves room for each chip's 44px tap area inside the scrolling row.
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1"
    >
      {chips.map((c) => {
        const on = c.value === value;
        const cls = cn(
          // Like Chip (60·30·10): Card with a lift; selected is Midnight with heavier text.
          "hit flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-subhead shadow-card transition-colors contrast-more:border contrast-more:border-label",
          on
            ? "bg-midnight font-semibold text-on-fill"
            : "bg-surface font-medium text-label hover:bg-raised",
        );
        const inner = (
          <>
            {c.label}
            {c.count !== undefined && (
              <span className={cn("text-footnote tabular-nums", on ? "opacity-70" : "text-sec")}>
                {c.count}
              </span>
            )}
          </>
        );
        return c.href ? (
          <Link key={c.value} href={c.href} aria-current={on ? "page" : undefined} className={cls}>
            {inner}
          </Link>
        ) : (
          <button
            key={c.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(c.value)}
            className={cls}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
