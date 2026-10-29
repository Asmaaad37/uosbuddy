"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LifeBuoy, MessageCircle, Newspaper, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Section 6.3 #8. Feed, Backup and Chats arrive in later phases; until then they say so
// instead of linking to a page that doesn't exist.
const ITEMS = [
  { label: "Explore", href: "/explore", icon: Compass, match: ["/explore", "/people"] },
  { label: "Feed", icon: Newspaper },
  { label: "Backup", icon: LifeBuoy, center: true },
  { label: "Chats", icon: MessageCircle },
  { label: "Me", href: "/me", icon: UserRound, match: ["/me"] },
] as const;

export function BottomNav() {
  const path = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const center = "center" in item && item.center;
          if (!("href" in item)) {
            return (
              <li key={item.label} className="flex-1">
                <span
                  aria-disabled
                  className="flex h-16 flex-col items-center justify-center gap-0.5 text-ink-2/60"
                >
                  <span
                    className={cn(
                      "grid place-items-center",
                      center && "-mt-6 size-14 rounded-pill border-4 border-bg bg-lane-help/40",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="text-[11px] font-semibold">{item.label}</span>
                  <span className="sr-only">(coming soon)</span>
                  <span aria-hidden className="text-[9px] tracking-wide uppercase">
                    Soon
                  </span>
                </span>
              </li>
            );
          }
          const on = item.match.some((m) => path === m || path.startsWith(`${m}/`));
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  on ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className={cn("size-6", on && "text-brand")} strokeWidth={on ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
