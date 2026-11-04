-- Phase 10 load test fixes (k6, 100 students: feed p95 4.4 s, chat 2.5 s).
--
-- 1. posts_public is a security_barrier view, so "order by hot_score limit 20" from outside
--    can't use the index: every visible post was filtered and fully projected before the
--    sort. feed_page walks the index in order and builds only the rows it returns, keeping
--    the view (and its barrier) as the one definition of what a student may see.
-- 2. The messages policy called is_member() once per row; it now reads the caller's
--    conversation ids once per query.
-- 3. Every message updated its conversation's last_message_at, so a busy group chat
--    queued on one row lock. It's now refreshed at most once a second.

create or replace function public.feed_page(
  p_space text,
  p_sort text default 'hot',
  p_after_score double precision default null,
  p_after_created timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 20
) returns setof public.posts_public
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_uni uuid := public.my_university_id();
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if p_sort = 'new' then
    return query
      select v.* from public.posts p
      -- Lateral, so the (leakproof) id lookup reaches into the barrier view per row.
      cross join lateral (select * from public.posts_public pv where pv.id = p.id) v
      where p.university_id = v_uni and p.space = p_space and p.status <> 'removed'
        and (p_after_id is null or (p.created_at, p.id) < (p_after_created, p_after_id))
      order by p.created_at desc, p.id desc
      limit v_limit;
  else
    return query
      select v.* from public.posts p
      -- Lateral, so the (leakproof) id lookup reaches into the barrier view per row.
      cross join lateral (select * from public.posts_public pv where pv.id = p.id) v
      where p.university_id = v_uni and p.space = p_space and p.status <> 'removed'
        and (p_after_id is null or (p.hot_score, p.id) < (p_after_score, p_after_id))
      order by p.hot_score desc, p.id desc
      limit v_limit;
  end if;
end;
$fn$;
revoke execute on function public.feed_page(text, text, double precision, timestamptz, uuid, int)
  from public, anon;
grant execute on function public.feed_page(text, text, double precision, timestamptz, uuid, int)
  to authenticated;
-- Tie-breaks for the keyset (score or time, then id) are served by these.
create index if not exists posts_hot_page_idx on public.posts (university_id, space, hot_score desc, id desc);
create index if not exists posts_new_page_idx on public.posts (university_id, space, created_at desc, id desc);

-- The caller's chats, once per query.
create or replace function public.my_conversation_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(conversation_id), '{}') from public.conversation_members
  where user_id = auth.uid();
$$;
revoke execute on function public.my_conversation_ids() from public, anon;
grant execute on function public.my_conversation_ids() to authenticated;
drop policy if exists messages_member on public.messages;
create policy messages_member on public.messages for select to authenticated
  using (conversation_id in (select unnest(public.my_conversation_ids())));

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
  -- At most once a second: chat lists sort by it, and a busy group would otherwise
  -- queue every sender on this one row.
  update public.conversations set last_message_at = v_msg.created_at
  where id = p_conversation
    and (last_message_at is null or last_message_at < v_msg.created_at - interval '1 second');
  update public.conversation_members set last_read_at = v_msg.created_at
  where conversation_id = p_conversation and user_id = v_me;
  return v_msg;
end;
$$;
