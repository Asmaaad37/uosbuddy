"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LifeBuoy, MessageCircle, Newspaper, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Section 6.3 #8.
const ITEMS = [
  { label: "Explore", href: "/explore", icon: Compass, match: ["/explore", "/people"] },
  { label: "Feed", href: "/feed", icon: Newspaper, match: ["/feed"] },
  { label: "Backup", href: "/backup", icon: LifeBuoy, match: ["/backup"], center: true },
  { label: "Chats", href: "/chats", icon: MessageCircle, match: ["/chats"] },
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
                {center ? (
                  // Backup: the signature feature sits raised in the middle (§6.3 #8).
                  <span className="-mt-7 grid size-14 place-items-center rounded-pill border-4 border-bg bg-lane-help text-lane-help-ink shadow-lift">
                    <Icon className="size-6" strokeWidth={2} />
                  </span>
                ) : (
                  <Icon
                    className={cn("size-6", on && "text-brand")}
                    strokeWidth={on ? 2.25 : 1.75}
                  />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
