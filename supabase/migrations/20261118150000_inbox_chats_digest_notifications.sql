-- C18, C19, C20, C21 from the engineering review.
--   C18: every signed-in screen listened to all new messages and Realtime checked each one
--        against every listener's permissions. Now each message sends a small signal to
--        each member's own private "inbox:{user}" channel, and screens listen only there.
--   C19: opening one chat built the whole chat list; the list had no limit.
--   C20: the weekly digest always picked the 400 most active students, so quieter ones never
--        got it. It now rotates: whoever waited longest goes first, at most once in 6 days.
--   C21: notifications were kept forever and only the newest 60 could be seen.

-- ===========================================================================
-- C18: a private inbox channel per student.
-- ===========================================================================
-- Topics a student may join: a chat they're in (typing), or their own inbox.
create or replace function public.can_read_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_use_topic(p_topic)
      or p_topic = 'inbox:' || auth.uid()::text;
$$;
revoke execute on function public.can_read_topic(text) from public, anon;
grant execute on function public.can_read_topic(text) to authenticated;

-- Reading allows the inbox too; writing stays chat-only (only the database writes to inboxes).
drop policy conversation_channel_read on realtime.messages;
create policy conversation_channel_read on realtime.messages for select to authenticated
  using (public.can_read_topic((select realtime.topic())));

-- After each message: "something new in chat X" to every member's inbox. No message text:
-- the chat screen loads that itself, with its own permissions.
create or replace function public.message_to_inboxes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('conversation_id', new.conversation_id, 'at', new.created_at),
    'message', 'inbox:' || m.user_id::text, true)
  from public.conversation_members m
  where m.conversation_id = new.conversation_id;
  return null;
end;
$$;
revoke execute on function public.message_to_inboxes() from public, anon, authenticated;
create trigger messages_to_inboxes after insert on public.messages
  for each row execute function public.message_to_inboxes();

-- ===========================================================================
-- C19: one chat by id; the list capped and newest first.
-- ===========================================================================
-- The chat-list rows for these chats, for the caller. `p_single` opens a chat even if the
-- caller hid it from their list.
create or replace function public.conversation_rows(p_ids uuid[], p_single boolean)
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
  where me.conversation_id = any(p_ids) and me.user_id = auth.uid() and public.is_verified()
    and (c.kind not in ('dm', 'ping') or (o.id is not null and not public.blocked_between(auth.uid(), o.id)))
    and (c.kind <> 'dm' or lm.id is not null or me.accepted_at is not null)
    and (p_single or me.hidden_at is null or lm.created_at > me.hidden_at)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;
revoke execute on function public.conversation_rows(uuid[], boolean) from public, anon, authenticated;

-- One chat (p_only), straight to it by id; or the caller's chats, newest first, up to p_limit.
drop function if exists public.my_conversations(uuid);
create function public.my_conversations(p_only uuid default null, p_limit int default 200)
returns table (
  id uuid, kind public.conversation_kind, title text, emoji text,
  other_id uuid, other_handle text, other_name text, other_avatar text,
  last_body text, last_sender_id uuid, last_at timestamptz,
  unread int, muted boolean, is_request boolean, member_count int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_only is not null then
    return query select * from public.conversation_rows(array[p_only], true);
    return;
  end if;
  return query select * from public.conversation_rows(array(
    select m.conversation_id
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.user_id = auth.uid()
    order by coalesce(c.last_message_at, c.created_at) desc
    limit least(greatest(p_limit, 1), 1000)
  ), false);
end;
$$;
revoke execute on function public.my_conversations(uuid, int) from public, anon;
grant execute on function public.my_conversations(uuid, int) to authenticated;

-- ===========================================================================
-- C20: digest rotation.
-- ===========================================================================
create table public.digest_log (
  user_id uuid primary key references public.profiles on delete cascade,
  sent_at timestamptz not null
);
alter table public.digest_log enable row level security;
revoke all on public.digest_log from anon, authenticated;
grant all on public.digest_log to service_role;

-- Students due a digest: none in the last 6 days, longest wait first (never sent = first).
drop function if exists public.digest_recipients(int);
create function public.digest_recipients(p_limit int default 150)
returns table (user_id uuid, email text, full_name text, new_batchmates int, open_backup int,
               upcoming_events int, unread_notifications int)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(pp.personal_email, pp.uni_email)::text, p.full_name,
    (select count(*)::int from public.profiles x
     where x.department_id = p.department_id and x.batch_year = p.batch_year and x.id <> p.id
       and x.verification_status = 'verified' and x.verified_at > now() - interval '7 days'),
    (select count(*)::int from public.backup_requests b
     where b.university_id = p.university_id and b.status = 'open' and b.expires_at > now()
       and b.requester_id <> p.id and (b.department_id is null or b.department_id = p.department_id)),
    (select count(*)::int from public.events e
     where e.university_id = p.university_id and e.status = 'active'
       and e.starts_at between now() and now() + interval '7 days'),
    (select count(*)::int from public.notifications n where n.user_id = p.id and n.read_at is null)
  from public.profiles p
  join public.private_profile pp on pp.user_id = p.id
  left join public.notification_prefs np on np.user_id = p.id
  left join public.digest_log dl on dl.user_id = p.id
  where p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
    and coalesce(np.digest, true)
    and coalesce(pp.personal_email, pp.uni_email) is not null
    and (dl.sent_at is null or dl.sent_at < now() - interval '6 days')
  order by dl.sent_at nulls first, p.last_active_at desc nulls last
  limit least(greatest(p_limit, 1), 1000);
$$;

-- The cron marks everyone it considered (sent, or nothing new to say), so the queue moves on.
create or replace function public.mark_digest_considered(p_users uuid[]) returns void
language sql security definer set search_path = '' as $$
  insert into public.digest_log (user_id, sent_at)
  select u, now() from unnest(p_users) u
  on conflict (user_id) do update set sent_at = excluded.sent_at;
$$;
revoke execute on function public.digest_recipients(int), public.mark_digest_considered(uuid[])
  from public, anon, authenticated;
grant execute on function public.digest_recipients(int), public.mark_digest_considered(uuid[])
  to service_role;

-- ===========================================================================
-- C21: notifications kept 90 days, and paging.
-- ===========================================================================
create or replace function public.notifications_housekeeping() returns void
language sql security definer set search_path = '' as $$
  delete from public.notifications where created_at < now() - interval '90 days';
$$;
revoke execute on function public.notifications_housekeeping() from public, anon, authenticated;
select cron.schedule('notifications-housekeeping', '40 22 * * *',
                     'select public.notifications_housekeeping()');

-- Older pages: notifications before `p_before`.
drop function if exists public.my_notifications(int);
create function public.my_notifications(p_limit int default 50, p_before timestamptz default null)
returns table (id uuid, created_at timestamptz, type text, entity_type text, entity_id uuid,
               payload jsonb, read_at timestamptz,
               actor_handle text, actor_name text, actor_avatar text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.created_at, n.type, n.entity_type, n.entity_id, n.payload, n.read_at,
    a.handle::text, a.full_name,
    case when a.id is not null and public.visible_at(a.id,
      (select photo_visibility from public.privacy_settings where user_id = a.id))
      then a.avatar_url end
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.user_id = auth.uid()
    and (p_before is null or n.created_at < p_before)
    and (a.id is null or not public.blocked_between(auth.uid(), a.id))
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.my_notifications(int, timestamptz) from public, anon;
grant execute on function public.my_notifications(int, timestamptz) to authenticated;
