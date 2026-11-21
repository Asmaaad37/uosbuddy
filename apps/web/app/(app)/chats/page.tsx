import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, MessageCircle, Plus, SquarePen, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { type ChatRowData } from "@/components/chat/chat-row";
import { ChatsBrowser } from "@/components/chat/chats-browser";
import { ChatsLive } from "@/components/chat/chats-live";
import { JoinBatchChat } from "@/components/chat/join-batch-chat";
import { RequestRow } from "@/components/chat/request-row";
import { BellSlot } from "@/components/notifications/bell-slot";
import { Button, IconButton } from "@/components/ui/button";
import { Overline } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getSession } from "@/lib/auth/session";
import { shortTime } from "@/lib/chat";

export const metadata: Metadata = { title: "Chats" };

const TABS = [
  { key: "primary", label: "Primary" },
  { key: "requests", label: "Requests" },
  { key: "groups", label: "Groups" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string; all?: string }> };

/** Most students have far fewer; past this, the list offers the rest on request. */
const LIST_LIMIT = 200;

/** Phase 4 task 3: Primary · Requests · Groups. */
export default async function ChatsPage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user) redirect("/login?next=/chats");
  const { tab: tabParam, all: showAll } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "primary";

  const [{ data: conversations }, { data: requests }, { data: joined }, { data: dept }] =
    await Promise.all([
      supabase.rpc("my_conversations", { p_limit: showAll ? 1000 : LIST_LIMIT }),
      supabase.rpc("incoming_requests"),
      supabase.from("conversations").select("batch_key").not("batch_key", "is", null),
      profile?.department_id
        ? supabase
            .from("departments")
            .select("short_code")
            .eq("id", profile.department_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  // Batch and section chats on offer (Phase 4 task 4), keyed like join_batch_chat().
  const keys = new Set((joined ?? []).map((c) => c.batch_key));
  const batchName = dept && profile?.batch_year ? `${dept.short_code} ${profile.batch_year}` : null;
  const offers = batchName
    ? [
        !keys.has(`batch:${profile!.department_id}:${profile!.batch_year}`) && {
          scope: "batch" as const,
          title: `${dept!.short_code} · Batch ${profile!.batch_year}`,
          hint: "Your batch chat",
        },
        profile!.section &&
          !keys.has(
            `section:${profile!.department_id}:${profile!.batch_year}:${profile!.section}:${profile!.shift ?? "-"}`,
          ) && {
            scope: "section" as const,
            title: `${batchName} · Section ${profile!.section}`,
            hint: "Your section chat",
          },
      ].filter((o): o is { scope: "batch" | "section"; title: string; hint: string } => !!o)
    : [];
  const all = conversations ?? [];
  const lists: Record<Tab, typeof all> = {
    primary: all.filter((c) => (c.kind === "dm" || c.kind === "ping") && !c.is_request),
    requests: all.filter((c) => c.kind === "dm" && c.is_request),
    groups: all.filter((c) => c.kind !== "dm" && c.kind !== "ping"),
  };
  const counts: Record<Tab, number> = {
    primary: lists.primary.filter((c) => c.unread > 0 && !c.muted).length,
    requests: lists.requests.length + (requests?.length ?? 0),
    groups: lists.groups.filter((c) => c.unread > 0 && !c.muted).length,
  };
  const shown = lists[tab];

  const rows: ChatRowData[] = shown.map((c) => {
    const dm = c.kind === "dm" || c.kind === "ping";
    const mine = c.last_sender_id === user.id;
    return {
      id: c.id,
      name: dm ? (c.other_name ?? c.other_handle ?? "Student") : (c.title ?? "Group"),
      avatar: dm ? c.other_avatar : null,
      group: !dm,
      emoji: c.emoji,
      preview: c.last_body ? `${mine ? "You: " : ""}${c.last_body}` : "Say hi",
      time: shortTime(c.last_at),
      unread: c.unread,
      muted: c.muted,
    };
  });

  const empty = {
    primary: (
      <EmptyState
        icon={MessageCircle}
        title="No chats yet"
        mascot="idle"
        action={
          <Button asChild variant="tinted" size="sm">
            <Link href="/explore/batch">Find your batch</Link>
          </Button>
        }
      >
        Say hi to someone in your batch.
      </EmptyState>
    ),
    requests: (requests?.length ?? 0) === 0 && (
      <EmptyState icon={Inbox} title="No message requests">
        Messages from people you&apos;re not connected with wait here.
      </EmptyState>
    ),
    groups: offers.length === 0 && (
      <EmptyState
        icon={Users}
        title="No group chats yet"
        action={
          <Button asChild variant="tinted" size="sm">
            <Link href="/chats/new">New group</Link>
          </Button>
        }
      >
        Start one for a study group, a trip or your hostel floor.
      </EmptyState>
    ),
  }[tab];

  const before =
    tab === "groups" ? (
      <div className="grid gap-3">
        {offers.length > 0 && (
          <section aria-labelledby="suggested" className="grid gap-2">
            <Overline id="suggested" className="px-4">
              Suggested
            </Overline>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
              {offers.map((o) => (
                <JoinBatchChat key={o.scope} {...o} />
              ))}
            </div>
          </section>
        )}
        {(offers.length > 0 || lists.groups.length > 0) && (
          <Button asChild variant="tinted" block>
            <Link href="/chats/new">
              <Plus aria-hidden /> New group
            </Link>
          </Button>
        )}
      </div>
    ) : tab === "requests" && (requests?.length ?? 0) > 0 ? (
      <section aria-label="Connection requests" className="grid gap-3">
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
    ) : null;

  return (
    <AppShell>
      <ChatsLive />
      <ScreenHeader
        title="Chats"
        actions={
          <>
            <span className="lg:hidden">
              <BellSlot />
            </span>
            <IconButton asChild cta>
              <Link href="/chats/new" aria-label="New group chat">
                <SquarePen aria-hidden />
              </Link>
            </IconButton>
          </>
        }
      />
      <ChatsBrowser
        chats={rows}
        before={before}
        empty={empty}
        folders={
          <SegmentedControl
            label="Chat folders"
            value={tab}
            segments={TABS.map((t) => ({
              value: t.key,
              label: counts[t.key] > 0 ? `${t.label} (${counts[t.key]})` : t.label,
              href: t.key === "primary" ? "/chats" : `/chats?tab=${t.key}`,
            }))}
          />
        }
      />
      {!showAll && (conversations?.length ?? 0) >= LIST_LIMIT && (
        <Link
          href={tab === "primary" ? "/chats?all=1" : `/chats?tab=${tab}&all=1`}
          className="justify-self-center text-subhead font-semibold text-accent"
        >
          Show older chats
        </Link>
      )}
    </AppShell>
  );
}
