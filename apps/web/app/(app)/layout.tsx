import { Suspense } from "react";
import Link from "next/link";
import { UnreadChatsProvider } from "@/components/chat/unread-chats";
import { NavProgress } from "@/components/nav-progress";
import { BellSlot } from "@/components/notifications/bell-slot";
import { Avatar } from "@/components/ui/avatar";
import { Sidebar } from "@/components/ui/sidebar";
import { TabBar } from "@/components/ui/tab-bar";
import { getSession } from "@/lib/auth/session";

/**
 * Signed-in app shell (redesign §4): the floating tab bar on phones and tablets, a 248px
 * sidebar from 1024px. Content scrolls under translucent chrome, with a fade at the top
 * (behind the status bar) instead of a divider line.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  const name = profile?.full_name ?? profile?.handle ?? "Me";

  return (
    <UnreadChatsProvider userId={profile?.id ?? null}>
      <Suspense>
        <NavProgress />
      </Suspense>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[calc(env(safe-area-inset-top)+12px)] bg-gradient-to-b from-bg from-[calc(100%-12px)] to-transparent"
      />
      <Sidebar
        className="hidden lg:flex"
        footer={
          <>
            <Link href="/me" className="rounded-pill">
              {/* Named by the hidden text, so the visible initials don't clash with it. */}
              <span aria-hidden>
                <Avatar name={name} src={profile?.avatar_url} size={36} />
              </span>
              <span className="sr-only">My profile</span>
            </Link>
            <span className="min-w-0 flex-1 truncate text-subhead">{name}</span>
            <BellSlot />
          </>
        }
      />
      <div className="app-page bg-bg pb-[calc(64px+22px+24px+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-[248px]">
        {children}
      </div>
      <TabBar className="lg:hidden" />
    </UnreadChatsProvider>
  );
}
