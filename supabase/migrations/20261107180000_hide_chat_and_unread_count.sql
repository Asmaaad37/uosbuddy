-- 1. Delete (hide) a one-to-one chat from your Chats list (redesign §5.4 #5, swipe action).
--    It only leaves *your* list: the other student keeps it, and it comes back for you as
--    soon as either of you sends a new message.
-- 2. unread_chat_count(): the number on the Chats tab. It is the sum of what the Chats list
--    shows as unread (so the two always agree), leaving out muted chats.

alter table public.conversation_members add column hidden_at timestamptz;

create or replace function public.hide_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation and m.user_id = auth.uid() and c.kind in ('dm', 'ping')
  ) then
    raise exception 'Chat not found' using errcode = 'P0002';
  end if;
  -- Hiding also marks it read, so it doesn't keep counting on the Chats tab.
  update public.conversation_members set hidden_at = now(), last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
end;
$$;

-- my_conversations (from 20261103100000) plus: hidden chats stay out of the list until a
-- message newer than the hide arrives.
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
    and (me.hidden_at is null or lm.created_at > me.hidden_at)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

create or replace function public.unread_chat_count() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(unread), 0)::int from public.my_conversations() where not muted;
$$;

revoke execute on function public.hide_conversation(uuid), public.unread_chat_count()
  from public, anon;
grant execute on function public.hide_conversation(uuid), public.unread_chat_count()
  to authenticated;
