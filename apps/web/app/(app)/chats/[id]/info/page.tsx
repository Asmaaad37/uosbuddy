import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GroupInfo } from "@/components/chat/group-info";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Group info" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/;

/**
 * C4: who's in a group chat. In a group someone made, its owner and admins can rename it, add
 * connections and remove people. Study groups and ride chats only list their members: who's
 * in them follows the course and the seats.
 */
export default async function GroupInfoPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/chats/${id}/info`);

  const [{ data: conversations }, { data: people }, { data: row }, { data: ride }] =
    await Promise.all([
      supabase.rpc("my_conversations", { p_only: id }),
      supabase.rpc("conversation_people", { p_conversation: id }),
      supabase.from("conversations").select("course_id").eq("id", id).maybeSingle(),
      supabase.from("rides").select("id").eq("conversation_id", id).maybeSingle(),
    ]);
  const conversation = conversations?.[0];
  if (!conversation || conversation.kind === "dm" || conversation.kind === "ping") notFound();

  const myRole = people?.find((p) => p.id === user.id)?.role ?? "member";
  const custom = conversation.kind === "group" && !row?.course_id && !ride;
  const manage = custom && (myRole === "owner" || myRole === "admin");

  // People you could add: your connections who aren't in the group yet.
  const inGroup = new Set((people ?? []).map((p) => p.id));
  const { data: connections } = manage ? await supabase.rpc("my_connections") : { data: [] };

  return (
    <AppShell back={`/chats/${id}`} backLabel="Back to chat">
      <GroupInfo
        conversationId={id}
        me={user.id}
        kind={conversation.kind}
        title={conversation.title ?? "Group"}
        emoji={conversation.emoji ?? ""}
        myRole={myRole}
        manage={manage}
        isRide={!!ride}
        people={(people ?? []).map((p) => ({
          id: p.id,
          handle: p.handle,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
        }))}
        addable={(connections ?? []).filter((c) => !inGroup.has(c.id))}
      />
    </AppShell>
  );
}
