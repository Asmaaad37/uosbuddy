import { Compass, LifeBuoy, MessageCircle, Newspaper, UserRound } from "lucide-react";

/** The five destinations (redesign §3–4), shared by the TabBar and the Sidebar. */
export const NAV_ITEMS = [
  { label: "Explore", href: "/explore", icon: Compass, match: ["/explore", "/people"] },
  { label: "Feed", href: "/feed", icon: Newspaper, match: ["/feed"] },
  { label: "Backup", href: "/backup", icon: LifeBuoy, match: ["/backup"] },
  { label: "Chats", href: "/chats", icon: MessageCircle, match: ["/chats"] },
  { label: "Me", href: "/me", icon: UserRound, match: ["/me"] },
] as const;

export const isActive = (path: string, match: readonly string[]) =>
  match.some((m) => path === m || path.startsWith(`${m}/`));
