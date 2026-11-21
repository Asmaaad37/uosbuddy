"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { cn } from "@/lib/utils";

/**
 * Screen header (redesign §3): a 44px toolbar row (back on the left, icon buttons on the
 * right), then the large title 6px below. Once the large title scrolls away, a centred
 * 17/600 inline title appears over the --bar material; scrolling back reverses it.
 */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  actionsBesideTitle = false,
  back,
  backLabel = "Back",
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  /** A short line above the title, in Muted (Explore shows the date). */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /** Put the actions next to the large title instead of in the toolbar row. */
  actionsBesideTitle?: boolean;
  back?: string;
  backLabel?: string;
  className?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Driven by scroll position, not time (spec §6): as the large title slides under the
  // toolbar, the bar material and the inline title fade in by the same amount, and
  // scrolling back reverses it exactly.
  useEffect(() => {
    const title = titleRef.current;
    const bar = barRef.current;
    if (!title || !bar) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = title.getBoundingClientRect();
      const toolbarBottom = bar.getBoundingClientRect().bottom;
      // 0 while the title is fully below the toolbar, 1 once it has passed under it.
      const p = Math.min(1, Math.max(0, (toolbarBottom - top) / Math.max(1, height)));
      bar.style.setProperty("--collapse", String(p));
      bar.dataset.collapsed = p >= 1 ? "true" : "false";
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <div
        ref={barRef}
        className="sticky top-0 z-30 -mx-4 flex h-[calc(44px+env(safe-area-inset-top))] items-end px-4 pt-[env(safe-area-inset-top)] [--collapse:0]"
      >
        <span
          aria-hidden
          style={{ opacity: "var(--collapse)" }}
          className="absolute inset-0 -z-10 bg-bar backdrop-blur-[24px] backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-bg"
        />
        <div className="flex h-11 w-full items-center gap-2">
          <div className="flex min-w-11 flex-1">
            {back && (
              <BackLink
                href={back}
                label={backLabel}
                className="-ml-2 grid size-11 place-items-center rounded-pill text-accent active:scale-[0.97]"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </BackLink>
            )}
          </div>
          <p aria-hidden style={{ opacity: "var(--collapse)" }} className="text-headline">
            {title}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2">
            {!actionsBesideTitle && actions}
          </div>
        </div>
      </div>
      <div className={cn("mt-1.5 flex items-end justify-between gap-3", className)}>
        <div className="grid min-w-0 gap-1">
          {eyebrow && <p className="text-subhead font-semibold text-sec">{eyebrow}</p>}
          <h1 ref={titleRef} className="text-large-title">
            {title}
          </h1>
          {subtitle && <p className="text-body text-sec">{subtitle}</p>}
        </div>
        {actionsBesideTitle && actions && (
          <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>
        )}
      </div>
    </>
  );
}
