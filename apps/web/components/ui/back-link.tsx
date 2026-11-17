"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Back that goes back. Each page has a sensible parent (`href`), but a student who opened a
 * profile from a chat expects Back to return to the chat, and one who opened a post from the
 * feed expects their feed tab and sort. So: if this tab has an earlier page of ours to return
 * to, Back is the browser's back; otherwise (opened from a notification, a link, a new tab)
 * it goes to `href`.
 */
const KEY = "uosb-trail";
const FRESH_START =
  /^\/(login|start|auth|setup|pending|forgot-password|reset-password|banned)(\/|$)/;

function readTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeTrail(trail: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-50)));
  } catch {
    // Private mode or storage off: Back simply uses its fixed page.
  }
}

/** Mounted once (in Providers): keeps the trail of pages visited in this tab. */
export function useBackTrail() {
  const pathname = usePathname();
  useEffect(() => {
    if (FRESH_START.test(pathname)) return writeTrail([]);
    const trail = readTrail();
    if (trail.at(-2) === pathname)
      trail.pop(); // went back
    else if (trail.at(-1) !== pathname) trail.push(pathname); // went somewhere new
    writeTrail(trail);
  }, [pathname]);
}

export function BackLink({
  href,
  className,
  label = "Back",
  children,
}: {
  href: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        // A modified click (new tab, etc.) keeps the plain link.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (readTrail().length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
