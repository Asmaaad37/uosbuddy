-- Phase 4 (part 1): connections, chats, messages, reports. Every write goes through a
-- security-definer function that checks verification, blocks, profile visibility and the
-- recipient's allow_dms_from, so RLS only has to grant reads. Realtime delivers message
-- inserts (RLS: members only) and typing broadcasts on private `conversation:{id}` channels.

-- ===========================================================================
-- Connections (§4.3)
-- ===========================================================================
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  requester_id uuid not null references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  status public.connection_status not null default 'pending',
  message text check (char_length(message) <= 300),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index connections_pair_uq
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
create index connections_requester_idx on public.connections (requester_id, status);
alter table public.connections enable row level security;
-- No policies: students read connections only through the functions below, which never
-- reveal that a request was declined.

-- Phase 2's stub becomes real. Only callable from inside other functions: a student must
-- not be able to ask whether two other students are connected.
create or replace function public.are_connected(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.connections
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;
revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;

-- Either student blocked the other (internal).
create or replace function public.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;

-- The caller and another student, from the caller's side:
-- 'none' | 'outgoing' | 'incoming' | 'connected'. A request the other declined still reads
-- 'outgoing', so nobody learns they were turned down.
create or replace function public.connection_state(p_other uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when c.status = 'accepted' then 'connected'
      when c.requester_id = auth.uid() then 'outgoing'
      when c.status = 'pending' then 'incoming'
      else 'none'
    end
    from public.connections c
    where least(c.requester_id, c.addressee_id) = least(auth.uid(), p_other)
      and greatest(c.requester_id, c.addressee_id) = greatest(auth.uid(), p_other)
  ), 'none');
$$;

-- Ask to connect, optionally answering their Opening Move. Returns the new state.
-- Asking someone who already asked you connects you both.
create or replace function public.request_connection(p_target uuid, p_message text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_row public.connections;
  v_message text := nullif(trim(p_message), '');
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target = v_me or public.blocked_between(v_me, p_target)
     or not public.can_view_profile(p_target) then
    raise exception 'You can''t connect with this student' using errcode = '42501';
  end if;
  if char_length(v_message) > 300 then
    raise exception 'Keep your note under 300 characters' using errcode = '22023';
  end if;

  select * into v_row from public.connections
  where least(requester_id, addressee_id) = least(v_me, p_target)
    and greatest(requester_id, addressee_id) = greatest(v_me, p_target)
  for update;

  if not found then
    insert into public.connections (requester_id, addressee_id, message)
    values (v_me, p_target, v_message);
    return 'outgoing';
  end if;

  if v_row.status = 'accepted' then
    return 'connected';
  end if;
  if v_row.status = 'pending' and v_row.addressee_id = v_me then
    update public.connections set status = 'accepted', responded_at = now() where id = v_row.id;
    return 'connected';
  end if;
  if v_row.status = 'declined' and v_row.addressee_id = v_me then
    -- You once declined them and now ask yourself: start over in your direction.
    update public.connections
       set requester_id = v_me, addressee_id = p_target, status = 'pending',
           message = v_message, responded_at = null, created_at = now()
     where id = v_row.id;
    return 'outgoing';
  end if;
  if v_row.status = 'declined' and v_row.responded_at < now() - interval '30 days' then
    update public.connections
       set status = 'pending', message = v_message, responded_at = null, created_at = now()
     where id = v_row.id;
  end if;
  return 'outgoing';
end;
$$;

-- Accept or decline a request someone sent you.
create or replace function public.respond_connection(p_requester uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = '' as $$
begin
  update public.connections
     set status = case when p_accept then 'accepted' else 'declined' end::public.connection_status,
         responded_at = now()
   where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'No request to answer' using errcode = 'P0002';
  end if;
  if p_accept then
    -- A message request between you is no longer a request.
    update public.conversation_members m set accepted_at = coalesce(m.accepted_at, now())
    from public.conversations c
    where c.id = m.conversation_id and c.kind = 'dm' and m.user_id = auth.uid()
      and c.dm_key = public.dm_key(auth.uid(), p_requester);
  end if;
  return case when p_accept then 'connected' else 'none' end;
end;
$$;

-- Requests waiting for the caller, newest first, with what the sender wrote.
create or replace function public.incoming_requests()
returns table (requester_id uuid, handle text, full_name text, avatar_url text,
               message text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name,
    case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end,
    c.message, c.created_at
  from public.connections c
  join public.profiles p on p.id = c.requester_id
  join public.privacy_settings s on s.user_id = p.id
  where c.addressee_id = auth.uid() and c.status = 'pending'
    and p.banned_at is null and p.deleted_at is null
    and not public.blocked_between(auth.uid(), p.id)
  order by c.created_at desc;
$$;

-- The caller's connections (for starting chats and building groups).
create or replace function public.my_connections()
returns table (id uuid, handle text, full_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name,
    case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end
  from public.connections c
  join public.profiles p on p.id = case when c.requester_id = auth.uid()
                                        then c.addressee_id else c.requester_id end
  join public.privacy_settings s on s.user_id = p.id
  where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
    and p.banned_at is null and p.deleted_at is null
  order by lower(coalesce(p.full_name, p.handle::text));
$$;

-- Withdraw your request, or disconnect.
create or replace function public.remove_connection(p_other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.connections
  where least(requester_id, addressee_id) = least(auth.uid(), p_other)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_other)
    and (status = 'accepted' or requester_id = auth.uid());
$$;

-- ===========================================================================
-- Conversations, members, messages (§4.3)
-- ===========================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind public.conversation_kind not null,
  university_id uuid references public.universities,
  title text check (char_length(title) between 1 and 60),
  emoji text check (char_length(emoji) <= 8),
  dm_key text unique,      -- "{smaller id}:{larger id}" for DMs
  batch_key text unique,   -- "batch:{dept}:{year}" or "section:{dept}:{year}:{section}:{shift}"
  course_id uuid,
  created_by uuid references public.profiles on delete set null,
  last_message_at timestamptz,
  expires_at timestamptz
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  -- Null while a DM from a non-connection waits in this member's Requests.
  accepted_at timestamptz,
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid references public.profiles on delete set null,
  body text check (char_length(body) between 1 and 4000),
  attachment_path text,
  reply_to_id uuid references public.messages on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  check (body is not null or attachment_path is not null or deleted_at is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc, id desc);

create or replace function public.dm_key(p_a uuid, p_b uuid) returns text
language sql immutable set search_path = '' as $$
  select least(p_a, p_b)::text || ':' || greatest(p_a, p_b)::text;
$$;

-- Is the caller in this conversation? (Used by RLS; definer avoids recursive policies.)
create or replace function public.is_member(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create policy conversations_member on public.conversations for select to authenticated
  using (public.is_member(id));
create policy members_member on public.conversation_members for select to authenticated
  using (public.is_member(conversation_id));
-- Your own row: mute and read position (columns limited by the grant below).
create policy members_self_update on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_member on public.messages for select to authenticated
  using (public.is_member(conversation_id));

-- Opens (or finds) the DM with another student and returns its id. Allowed when you're
-- connected, or when their allow_dms_from lets you; then it lands in their Requests.
create or replace function public.start_dm(p_target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_connected boolean;
  v_allowed public.visibility_level;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target = v_me or public.blocked_between(v_me, p_target)
     or not public.can_view_profile(p_target) then
    raise exception 'You can''t message this student' using errcode = '42501';
  end if;

  select id into v_id from public.conversations where dm_key = public.dm_key(v_me, p_target);
  if v_id is not null then
    return v_id;
  end if;

  v_connected := public.are_connected(v_me, p_target);
  select allow_dms_from into v_allowed from public.privacy_settings where user_id = p_target;
  if not v_connected and not public.visible_at(p_target, coalesce(v_allowed, 'everyone')) then
    raise exception 'This student only takes messages from %',
      case v_allowed when 'connections' then 'connections' when 'nobody' then 'nobody'
                     else 'some students' end
      using errcode = '42501';
  end if;

  insert into public.conversations (kind, university_id, dm_key, created_by)
  values ('dm', public.my_university_id(), public.dm_key(v_me, p_target), v_me)
  on conflict (dm_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.conversations where dm_key = public.dm_key(v_me, p_target);
    return v_id;
  end if;
  insert into public.conversation_members (conversation_id, user_id, role, accepted_at)
  values (v_id, v_me, 'member', now()),
         (v_id, p_target, 'member', case when v_connected then now() end);
  return v_id;
end;
$$;

-- Sends a message. Replying to a message request accepts it.
create or replace function public.send_message(
  p_conversation uuid,
  p_body text default null,
  p_attachment_path text default null,
  p_reply_to uuid default null
) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_conv public.conversations;
  v_other uuid;
  v_body text := nullif(trim(p_body), '');
  v_msg public.messages;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_conv from public.conversations where id = p_conversation;
  if not found or not public.is_member(p_conversation) then
    raise exception 'Not a member of this chat' using errcode = '42501';
  end if;
  if v_conv.expires_at is not null and v_conv.expires_at < now() then
    raise exception 'This chat has ended' using errcode = '42501';
  end if;
  if v_body is null and p_attachment_path is null then
    raise exception 'Write a message' using errcode = '22023';
  end if;
  if p_attachment_path is not null
     and split_part(p_attachment_path, '/', 1) <> p_conversation::text then
    raise exception 'That photo belongs to another chat' using errcode = '22023';
  end if;

  if v_conv.kind = 'dm' then
    select user_id into v_other from public.conversation_members
    where conversation_id = p_conversation and user_id <> v_me;
    if v_other is null or public.blocked_between(v_me, v_other) then
      raise exception 'You can''t message this student' using errcode = '42501';
    end if;
  end if;

  update public.conversation_members set accepted_at = now()
  where conversation_id = p_conversation and user_id = v_me and accepted_at is null;

  insert into public.messages (conversation_id, sender_id, body, attachment_path, reply_to_id)
  values (p_conversation, v_me, v_body, p_attachment_path,
          (select id from public.messages where id = p_reply_to and conversation_id = p_conversation))
  returning * into v_msg;
  update public.conversations set last_message_at = v_msg.created_at where id = p_conversation;
  update public.conversation_members set last_read_at = v_msg.created_at
  where conversation_id = p_conversation and user_id = v_me;
  return v_msg;
end;
$$;

-- Removes your own message for everyone (keeps a "message deleted" placeholder).
create or replace function public.delete_message(p_message uuid) returns void
language sql security definer set search_path = '' as $$
  update public.messages set body = null, attachment_path = null, deleted_at = now()
  where id = p_message and sender_id = auth.uid() and deleted_at is null;
$$;

-- Read receipts: everything up to now is read.
create or replace function public.mark_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Accept a message request (also happens by replying), or decline it: the chat is deleted.
create or replace function public.answer_message_request(p_conversation uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversation_members
                 where conversation_id = p_conversation and user_id = auth.uid()
                   and accepted_at is null) then
    raise exception 'No message request to answer' using errcode = 'P0002';
  end if;
  if p_accept then
    update public.conversation_members set accepted_at = now()
    where conversation_id = p_conversation and user_id = auth.uid();
  else
    delete from public.conversations where id = p_conversation and kind = 'dm';
  end if;
end;
$$;

-- ===========================================================================
-- Blocks: blocking also ends any connection; DMs disappear from both chat lists.
-- ===========================================================================
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_target = auth.uid() then
    raise exception 'You can''t block yourself' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target)
  on conflict do nothing;
  delete from public.connections
  where least(requester_id, addressee_id) = least(auth.uid(), p_target)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_target);
end;
$$;

create or replace function public.unblock_user(p_target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target;
$$;

-- ===========================================================================
-- Chat list: one row per conversation, newest first. Hides DMs across a block.
-- ===========================================================================
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
    where c.kind = 'dm' and om.conversation_id = c.id and om.user_id <> auth.uid() limit 1
  ) o on true
  left join lateral (
    select * from public.messages m where m.conversation_id = c.id
    order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and (c.kind <> 'dm' or (o.id is not null and not public.blocked_between(auth.uid(), o.id)))
    -- An empty DM you started isn't worth listing on their side yet.
    and (c.kind <> 'dm' or lm.id is not null or me.accepted_at is not null)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- Who's in a conversation, with names and photos as privacy allows, and read positions.
create or replace function public.conversation_people(p_conversation uuid)
returns table (id uuid, handle text, full_name text, avatar_url text, role text,
               last_read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name,
    case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end,
    m.role, m.last_read_at
  from public.conversation_members m
  join public.profiles p on p.id = m.user_id
  join public.privacy_settings s on s.user_id = p.id
  where m.conversation_id = p_conversation and public.is_member(p_conversation);
$$;

-- ===========================================================================
-- Batch and section group chats, created the first time someone joins (opt-in).
-- ===========================================================================
create or replace function public.join_batch_chat(p_scope text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_key text;
  v_title text;
  v_code text;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  select short_code into v_code from public.departments where id = v_me.department_id;
  if v_code is null or v_me.batch_year is null then
    raise exception 'Add your department and session first' using errcode = '22023';
  end if;
  if p_scope = 'batch' then
    v_key := format('batch:%s:%s', v_me.department_id, v_me.batch_year);
    v_title := format('%s %s', v_code, v_me.batch_year);
  elsif p_scope = 'section' and v_me.section is not null then
    v_key := format('section:%s:%s:%s:%s', v_me.department_id, v_me.batch_year, v_me.section,
                    coalesce(v_me.shift::text, '-'));
    v_title := format('%s %s · Sec %s', v_code, v_me.batch_year, v_me.section)
      || coalesce(' · ' || initcap(v_me.shift::text), '');
  else
    raise exception 'Add your section first' using errcode = '22023';
  end if;

  insert into public.conversations (kind, university_id, title, batch_key, created_by)
  values ('batch', v_me.university_id, v_title, v_key, v_me.id)
  on conflict (batch_key) do nothing;
  select id into v_id from public.conversations where batch_key = v_key;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_id, v_me.id, now())
  on conflict do nothing;
  return v_id;
end;
$$;

-- ===========================================================================
-- Custom groups: up to 50, members chosen from your connections.
-- ===========================================================================
create or replace function public.create_group(p_title text, p_emoji text, p_members uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_members uuid[] := array(select distinct x from unnest(p_members) x where x <> auth.uid());
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if char_length(trim(p_title)) not between 1 and 60 then
    raise exception 'Give the group a name' using errcode = '22023';
  end if;
  if cardinality(v_members) = 0 or cardinality(v_members) > 49 then
    raise exception 'Pick between 1 and 49 people' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_members) x where not public.are_connected(auth.uid(), x)) then
    raise exception 'You can only add your connections' using errcode = '42501';
  end if;
  insert into public.conversations (kind, university_id, title, emoji, created_by)
  values ('group', public.my_university_id(), trim(p_title), nullif(trim(p_emoji), ''), auth.uid())
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, role, accepted_at)
  select v_id, auth.uid(), 'owner', now()
  union all
  select v_id, x, 'member', now() from unnest(v_members) x;
  return v_id;
end;
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.conversation_members m
                 join public.conversations c on c.id = m.conversation_id
                 where m.conversation_id = p_conversation and m.user_id = auth.uid()
                   and m.role in ('owner', 'admin') and c.kind = 'group') then
    raise exception 'Only group admins can add people' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(p_members) x where not public.are_connected(auth.uid(), x)) then
    raise exception 'You can only add your connections' using errcode = '42501';
  end if;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  select p_conversation, x, now() from unnest(p_members) x
  on conflict do nothing;
  if (select count(*) from public.conversation_members where conversation_id = p_conversation) > 50 then
    raise exception 'Groups hold up to 50 people' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.leave_conversation(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = auth.uid()
    and (select kind from public.conversations where id = p_conversation) in ('group', 'batch');
$$;

-- ===========================================================================
-- Reports (§4.3): anyone verified can report; only admins and moderators read them.
-- ===========================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references public.profiles on delete set null,
  target_type text not null check (target_type in ('profile', 'message', 'conversation', 'post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'fake', 'inappropriate', 'other')),
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles on delete set null,
  handled_at timestamptz
);
create index reports_open_idx on public.reports (status, created_at desc);
create unique index reports_once_uq on public.reports (reporter_id, target_type, target_id)
  where status = 'open';
alter table public.reports enable row level security;
create policy reports_staff on public.reports for select to authenticated
  using ((select public.is_admin())
         or exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'moderator'));

create or replace function public.report(
  p_target_type text, p_target_id uuid, p_reason text, p_details text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  -- You can only report a message from a chat you're in.
  if p_target_type = 'message' and not exists (
    select 1 from public.messages where id = p_target_id and public.is_member(conversation_id)
  ) then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  on conflict do nothing;
end;
$$;

-- ===========================================================================
-- Photo attachments: private bucket, {conversation_id}/{uuid}.{ext}, members only.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 2097152,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create or replace function public.can_use_conversation_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
     and public.is_member(((storage.foldername(p_name))[1])::uuid);
$$;

create policy chat_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and public.can_use_conversation_path(name));
create policy chat_attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and public.can_use_conversation_path(name));

-- ===========================================================================
-- Realtime: message inserts (RLS above) and private typing channels for members.
-- ===========================================================================
alter publication supabase_realtime add table public.messages, public.conversation_members;

create or replace function public.can_use_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_topic ~ '^conversation:[0-9a-f-]{36}$'
     and public.is_member(substr(p_topic, 14)::uuid);
$$;

create policy conversation_channel_read on realtime.messages for select to authenticated
  using (public.can_use_topic((select realtime.topic())));
create policy conversation_channel_write on realtime.messages for insert to authenticated
  with check (public.can_use_topic((select realtime.topic())));

-- ===========================================================================
-- Grants: reads through RLS, writes only through the functions above.
-- ===========================================================================
revoke all on public.connections, public.conversations, public.conversation_members,
  public.messages, public.reports from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages,
  public.reports to authenticated;
grant update (muted, last_read_at) on public.conversation_members to authenticated;
grant all on public.connections, public.conversations, public.conversation_members,
  public.messages, public.reports to service_role;

revoke execute on function
  public.connection_state(uuid), public.request_connection(uuid, text),
  public.respond_connection(uuid, boolean), public.remove_connection(uuid),
  public.incoming_requests(), public.my_connections(),
  public.start_dm(uuid), public.send_message(uuid, text, text, uuid),
  public.delete_message(uuid), public.mark_read(uuid),
  public.answer_message_request(uuid, boolean), public.block_user(uuid),
  public.unblock_user(uuid), public.my_conversations(), public.conversation_people(uuid),
  public.join_batch_chat(text), public.create_group(text, text, uuid[]),
  public.add_group_members(uuid, uuid[]), public.leave_conversation(uuid),
  public.report(text, uuid, text, text), public.is_member(uuid),
  public.can_use_conversation_path(text), public.can_use_topic(text), public.dm_key(uuid, uuid)
from public, anon;
grant execute on function
  public.connection_state(uuid), public.request_connection(uuid, text),
  public.respond_connection(uuid, boolean), public.remove_connection(uuid),
  public.incoming_requests(), public.my_connections(),
  public.start_dm(uuid), public.send_message(uuid, text, text, uuid),
  public.delete_message(uuid), public.mark_read(uuid),
  public.answer_message_request(uuid, boolean), public.block_user(uuid),
  public.unblock_user(uuid), public.my_conversations(), public.conversation_people(uuid),
  public.join_batch_chat(text), public.create_group(text, text, uuid[]),
  public.add_group_members(uuid, uuid[]), public.leave_conversation(uuid),
  public.report(text, uuid, text, text), public.is_member(uuid),
  public.can_use_conversation_path(text), public.can_use_topic(text), public.dm_key(uuid, uuid)
to authenticated;
