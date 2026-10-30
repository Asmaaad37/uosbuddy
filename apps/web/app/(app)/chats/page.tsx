import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellOff, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChatsLive } from "@/components/chat/chats-live";
import { RequestRow } from "@/components/chat/request-row";
import { Avatar } from "@/components/ui/avatar";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chats" };

const TABS = [
  { key: "primary", label: "Primary" },
  { key: "requests", label: "Requests" },
  { key: "groups", label: "Groups" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string }> };

/** Phase 4 task 3: Primary · Requests · Groups. */
export default async function ChatsPage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/chats");
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "primary";

  const [{ data: conversations }, { data: requests }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase.rpc("incoming_requests"),
  ]);
  const all = conversations ?? [];
  const lists: Record<Tab, typeof all> = {
    primary: all.filter((c) => c.kind === "dm" && !c.is_request),
    requests: all.filter((c) => c.kind === "dm" && c.is_request),
    groups: all.filter((c) => c.kind !== "dm"),
  };
  const counts: Record<Tab, number> = {
    primary: lists.primary.filter((c) => c.unread > 0 && !c.muted).length,
    requests: lists.requests.length + (requests?.length ?? 0),
    groups: lists.groups.filter((c) => c.unread > 0 && !c.muted).length,
  };
  const shown = lists[tab];

  return (
    <AppShell>
      <ChatsLive userId={user.id} />
      <h1 className="text-[28px] leading-tight font-bold">Chats</h1>

      <nav aria-label="Chat folders" className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "primary" ? "/chats" : `/chats?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold",
              tab === t.key
                ? "border-ink bg-ink text-bg"
                : "border-line bg-surface text-ink hover:border-ink-2/50",
            )}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className={cn(
                  "grid min-w-5 place-items-center rounded-pill px-1 text-[11px]",
                  tab === t.key ? "bg-brand-soft text-ink" : "bg-brand text-brand-ink",
                )}
              >
                {counts[t.key]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "requests" && (requests?.length ?? 0) > 0 && (
        <section aria-label="Connection requests" className="grid gap-2">
          {requests!.map((r) => (
            <RequestRow
              key={r.requester_id}
              requester={r.requester_id}
              handle={r.handle}
              name={r.full_name ?? r.handle ?? "Student"}
              avatar={r.avatar_url}
              note={r.message}
            />
          ))}
        </section>
      )}

      {shown.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {shown.map((c) => {
            const name =
              c.kind === "dm"
                ? (c.other_name ?? c.other_handle ?? "Student")
                : (c.title ?? "Group");
            const mine = c.last_sender_id === user.id;
            return (
              <li key={c.id}>
                <Link
                  href={`/chats/${c.id}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-surface-2"
                >
                  {c.kind === "dm" ? (
                    <Avatar name={name} src={c.other_avatar} size="md" />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-lane-people text-lg text-lane-people-ink">
                      {c.emoji ?? <Users className="size-5" />}
                    </span>
                  )}
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("truncate", c.unread > 0 ? "font-bold" : "font-semibold")}
                      >
                        {name}
                      </span>
                      {c.muted && (
                        <BellOff className="size-3.5 shrink-0 text-ink-2" aria-label="Muted" />
                      )}
                      <span className="ml-auto shrink-0 text-xs text-ink-2">
                        {shortTime(c.last_at)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          c.unread > 0 ? "font-semibold text-ink" : "text-ink-2",
                        )}
                      >
                        {c.last_body ? `${mine ? "You: " : ""}${c.last_body}` : "Say hi 👋"}
                      </span>
                      {c.unread > 0 && (
                        <span
                          className={cn(
                            "ml-auto grid min-w-5 shrink-0 place-items-center rounded-pill px-1 text-[11px] font-semibold",
                            c.muted ? "bg-surface-2 text-ink-2" : "bg-brand text-brand-ink",
                          )}
                        >
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        !(tab === "requests" && (requests?.length ?? 0) > 0) && (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
            {tab === "primary" && (
              <>
                No chats yet.{" "}
                <Link href="/explore/batch" className="font-semibold text-brand">
                  Find your batch
                </Link>{" "}
                and say hi.
              </>
            )}
            {tab === "requests" && "No requests right now."}
            {tab === "groups" && "No group chats yet."}
          </p>
        )
      )}
    </AppShell>
  );
}
