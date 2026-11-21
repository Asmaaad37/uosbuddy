import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grouped list (redesign §3): a card of rows with an optional 13/600 uppercase header.
 * Separators are drawn on the text column only, so they start past the icon.
 */
export function GroupedList({
  header,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  header?: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section className={cn("grid gap-2", className)} aria-label={ariaLabel ?? header}>
      {header && <h2 className="px-4 text-overline text-ter uppercase">{header}</h2>}
      <ul className="overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label [&>li:last-child_[data-row-text]]:shadow-none">
        {children}
      </ul>
    </section>
  );
}

type RowProps = {
  icon?: React.ElementType;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shown before the chevron: a pill, a value, a switch. */
  trailing?: React.ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  /** Leading content other than an icon (an empty circle, an avatar). */
  leading?: React.ReactNode;
};

/** A row: 52px (60 with a subtitle), 22px Blue (--accent) icon, 17px title, 13px --ter subtitle. */
export function Row({
  icon: Icon,
  title,
  subtitle,
  trailing,
  chevron,
  href,
  onClick,
  destructive,
  leading,
}: RowProps) {
  const showChevron = chevron ?? !!href;
  const inner = (
    <>
      {leading ??
        (Icon && (
          <Icon className="size-[22px] shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
        ))}
      <span
        data-row-text
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-4 shadow-[inset_0_-1px_0_var(--sep)]",
          subtitle ? "min-h-[60px]" : "min-h-[52px]",
        )}
      >
        <span className="grid min-w-0 flex-1">
          <span className={cn("text-body", destructive ? "text-danger" : "text-label")}>
            {title}
          </span>
          {subtitle && <span className="text-footnote text-ter">{subtitle}</span>}
        </span>
        {trailing}
        {showChevron && <ChevronRight className="size-[18px] shrink-0 text-ter" aria-hidden />}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-4 pl-4 text-left transition-colors active:bg-raised";
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
