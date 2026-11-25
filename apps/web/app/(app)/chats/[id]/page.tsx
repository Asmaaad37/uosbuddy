import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Conversation } from "@/components/chat/conversation";
import { getSession } from "@/lib/auth/session";
import { switchOn } from "@/lib/switches.server";

export const metadata: Metadata = { title: "Chat" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/;

/** Phase 4 task 3: one conversation. Only members get past `my_conversations()`. */
export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/chats/${id}`);

  // my_conversations() also hides DMs across a block. Asking for this one chat opens it even
  // if you deleted it from your list, as from an old notification or the back button.
  const [
    { data: conversations },
    { data: people },
    { data: messages },
    { data: row },
    { data: ride },
    chatOn,
  ] = await Promise.all([
    supabase.rpc("my_conversations", { p_only: id }),
    supabase.rpc("conversation_people", { p_conversation: id }),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
    supabase.from("conversations").select("expires_at").eq("id", id).maybeSingle(),
    supabase.from("rides").select("id").eq("conversation_id", id).maybeSingle(),
    switchOn(supabase, "chat"),
  ]);
  const conversation = conversations?.[0];
  if (!conversation) notFound();

  const paths = (messages ?? []).flatMap((m) => (m.attachment_path ? [m.attachment_path] : []));
  const { data: urls } = paths.length
    ? await supabase.storage.from("chat-attachments").createSignedUrls(paths, 60 * 60)
    : { data: [] };

  const title =
    conversation.kind === "dm" || conversation.kind === "ping"
      ? (conversation.other_name ?? conversation.other_handle ?? "Student")
      : (conversation.title ?? "Group");

  return (
    <Conversation
      conversationId={id}
      me={user.id}
      kind={conversation.kind}
      title={title}
      people={people ?? []}
      initialMessages={messages ?? []}
      signedUrls={Object.fromEntries(
        (urls ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl]] : [])),
      )}
      isRequest={conversation.is_request}
      muted={conversation.muted}
      endsAt={row?.expires_at ?? null}
      isRide={!!ride}
      paused={!chatOn}
    />
  );
}
