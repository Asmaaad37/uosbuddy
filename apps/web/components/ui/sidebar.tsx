"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UnreadBadge, useUnreadChats } from "@/components/chat/unread-chats";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Desktop sidebar (redesign §4, 1024px and up): 248px, the wordmark, the five destinations
 * as 44px rows (active: --tint background, --accent text), then the bell and your avatar.
 */
export function Sidebar({
  footer,
  className,
}: {
  /** Bell and avatar, rendered by the server layout. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const path = usePathname();
  const unread = useUnreadChats();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col gap-6 border-r border-sep bg-bg px-4 py-6",
        className,
      )}
    >
      <Link href="/explore" className="px-3 text-title2">
        UOSBuddy
      </Link>
      <nav aria-label="Main">
        <ul className="grid gap-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon, match }) => {
            const on = isActive(path, match);
            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  aria-label={
                    label === "Chats" && unread > 0 ? `Chats, ${unread} unread` : undefined
                  }
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-field px-3 text-headline transition-colors",
                    on ? "bg-tint text-accent" : "text-label hover:bg-surface",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={on ? 2.1 : 1.75} aria-hidden />
                  {label}
                  {label === "Chats" && <UnreadBadge count={unread} className="ml-auto" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer && <div className="mt-auto flex items-center gap-2 px-1">{footer}</div>}
    </aside>
  );
}
