"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar at the top that starts the instant a link is tapped and finishes when the
 * next page arrives, so every tap gets immediate feedback. Signed-in screens also show a
 * skeleton while they load ((app)/loading.tsx).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A new page (or new query) arrived: finish the bar, then hide it.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 250);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Capture phase: runs before handlers that navigate with router.push (the dock).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clearTimeout(timer.current);
      setState("loading");
      // Never stay stuck (e.g. a navigation that was cancelled).
      timer.current = setTimeout(() => setState("idle"), 10_000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (state === "idle") return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
    >
      <div
        className={
          state === "loading"
            ? "h-full w-[85%] origin-left bg-fill motion-safe:animate-[nav-progress_2.5s_cubic-bezier(0.1,0.7,0.2,1)_both]"
            : "h-full w-full bg-fill opacity-0 transition-opacity duration-200"
        }
      />
    </div>
  );
}
