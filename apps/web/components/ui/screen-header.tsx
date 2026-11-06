"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Screen header (redesign §3): a 44px toolbar row (back on the left, icon buttons on the
 * right), then the large title 6px below. Once the large title scrolls away, a centred
 * 17/600 inline title appears over the --bar material; scrolling back reverses it.
 */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  back,
  backLabel = "Back",
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: string;
  backLabel?: string;
  className?: string;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e!.isIntersecting), {
      rootMargin: "-44px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-30 -mx-4 flex h-[calc(44px+env(safe-area-inset-top))] items-end px-4 pt-[env(safe-area-inset-top)] transition-[background-color,backdrop-filter] duration-200",
          collapsed
            ? "bg-bar backdrop-blur-[24px] backdrop-saturate-[180%] [@media(prefers-reduced-transparency:reduce)]:bg-bg"
            : "bg-transparent",
        )}
      >
        <div className="flex h-11 w-full items-center gap-2">
          <div className="flex min-w-11 flex-1">
            {back && (
              <Link
                href={back}
                aria-label={backLabel}
                className="-ml-2 grid size-11 place-items-center rounded-pill text-accent active:scale-[0.97]"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </Link>
            )}
          </div>
          <p
            aria-hidden={!collapsed}
            className={cn(
              "text-headline transition-opacity duration-200",
              collapsed ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2">{actions}</div>
        </div>
      </div>
      <div className={cn("mt-1.5 grid gap-1", className)}>
        <h1 ref={titleRef} className="text-large-title">
          {title}
        </h1>
        {subtitle && <p className="text-body text-sec">{subtitle}</p>}
      </div>
    </>
  );
}
