"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UnreadBadge, useUnreadChats } from "@/components/chat/unread-chats";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Tab bar (redesign §3): a floating capsule, 16px from the sides and 22px + the safe area
 * from the bottom, 64px tall, translucent --bar material over the content, with a 104px
 * fade to --bg behind it. Five equal tabs; Backup is a normal tab. Phones and tablets only.
 */
export function TabBar({ className }: { className?: string }) {
  const path = usePathname();
  const unread = useUnreadChats();
  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40", className)}>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[calc(104px+env(safe-area-inset-bottom))] bg-gradient-to-b from-transparent to-bg"
      />
      <nav
        aria-label="Main"
        className="pointer-events-auto relative mx-4 mb-[calc(22px+env(safe-area-inset-bottom))] h-16 rounded-pill border border-bar-border bg-bar backdrop-blur-[24px] backdrop-saturate-[180%] motion-safe:transition-colors sm:mx-auto sm:max-w-[560px] [@media(prefers-reduced-transparency:reduce)]:bg-surface"
      >
        <ul className="flex h-full items-stretch">
          {NAV_ITEMS.map(({ label, href, icon: Icon, match }) => {
            const on = isActive(path, match);
            return (
              <li key={label} className="flex-1">
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  aria-label={
                    label === "Chats" && unread > 0 ? `Chats, ${unread} unread` : undefined
                  }
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 rounded-pill text-tab-label transition-transform duration-100 ease-out active:scale-[0.92]",
                    on ? "text-accent" : "text-sec hover:text-label",
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn("size-6", on && "tab-pop")}
                      strokeWidth={on ? 2.1 : 1.75}
                      aria-hidden
                    />
                    {label === "Chats" && (
                      <UnreadBadge
                        count={unread}
                        className="absolute -top-1.5 left-1/2 ml-1 ring-2 ring-bar"
                      />
                    )}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
