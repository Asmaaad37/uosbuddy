-- Phase 6: ping chats show the other person like a DM in the chats list (and hide across a
-- block), and course chats can be left like batch chats.

create or replace function public.my_conversations()
returns table (
  id uuid, kind public.conversation_kind, title text, emoji text,
  other_id uuid, other_handle text, other_name text, other_avatar text,
  last_body text, last_sender_id uuid, last_at timestamptz,
  unread int, muted boolean, is_request boolean, member_count int
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.title, c.emoji,
    o.id, o.handle::text, o.full_name,
    case when o.id is not null and public.visible_at(o.id,
      (select photo_visibility from public.privacy_settings where user_id = o.id))
      then o.avatar_url end,
    case when lm.deleted_at is not null then 'Message deleted'
         when lm.body is null and lm.attachment_path is not null then 'Photo'
         else left(lm.body, 120) end,
    lm.sender_id, coalesce(c.last_message_at, c.created_at),
    (select count(*)::int from public.messages x
      where x.conversation_id = c.id and x.sender_id is distinct from auth.uid()
        and x.created_at > coalesce(me.last_read_at, '-infinity')),
    me.muted, me.accepted_at is null,
    (select count(*)::int from public.conversation_members cm where cm.conversation_id = c.id)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select p.* from public.conversation_members om join public.profiles p on p.id = om.user_id
    where c.kind in ('dm', 'ping') and om.conversation_id = c.id and om.user_id <> auth.uid() limit 1
  ) o on true
  left join lateral (
    select * from public.messages m where m.conversation_id = c.id
    order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and (c.kind not in ('dm', 'ping') or (o.id is not null and not public.blocked_between(auth.uid(), o.id)))
    and (c.kind <> 'dm' or lm.id is not null or me.accepted_at is not null)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

create or replace function public.leave_conversation(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = auth.uid()
    and (select kind from public.conversations where id = p_conversation) in ('group', 'batch', 'course');
$$;
