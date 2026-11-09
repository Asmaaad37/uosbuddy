-- A chat you deleted leaves your list, but it should still open from an old notification or
-- the back button. my_conversations(p_only) returns just that chat, hidden or not, and only
-- if you're a member. The list itself (no argument) behaves as before.
drop function public.my_conversations();

create function public.my_conversations(p_only uuid default null)
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
    and (p_only is null or c.id = p_only)
    and (c.kind not in ('dm', 'ping') or (o.id is not null and not public.blocked_between(auth.uid(), o.id)))
    and (c.kind <> 'dm' or lm.id is not null or me.accepted_at is not null)
    and (p_only is not null or me.hidden_at is null or lm.created_at > me.hidden_at)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

revoke execute on function public.my_conversations(uuid) from public, anon;
grant execute on function public.my_conversations(uuid) to authenticated;
