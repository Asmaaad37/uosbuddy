-- Bans and account deletion promised more than they did: a banned or deleting student's posts
-- stayed up, and a banned login could still read their chats. Now anything they wrote is hidden
-- while the account is banned, being deleted or no longer verified, and it comes back by itself
-- if that's undone. Admins can also take verification away from someone.

-- True when this person's content shouldn't be shown to other students. Unknown ids (a purged
-- author) are false; files left behind by them are still handled by the uploader-null rules.
create or replace function public.person_hidden(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and (p.banned_at is not null or p.deleted_at is not null
           or p.verification_status <> 'verified'));
$$;
revoke execute on function public.person_hidden(uuid) from public, anon;
grant execute on function public.person_hidden(uuid) to authenticated;

-- Posts, comments, rides, listings, backup requests and leaderboards all ask this, so this one
-- line covers them.
create or replace function public.blocked_with(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.blocked_between(auth.uid(), p_other) or public.person_hidden(p_other);
$$;

-- A society's events belong to the society, so they stay when whoever created them is banned.
drop policy events_read on public.events;
create policy events_read on public.events for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id())
         and (society_id is not null or not public.person_hidden(created_by)));

create or replace function public.events_board(p_society uuid default null, p_mine boolean default false)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz,
               venue text, capacity int, status text, society_id uuid, society_name text,
               society_slug text, society_emoji text, going int, interested int, my_rsvp text,
               can_manage boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.description, e.starts_at, e.ends_at, e.venue, e.capacity, e.status,
    s.id, s.name, s.slug, s.emoji,
    (select count(*)::int from public.event_rsvps r where r.event_id = e.id and r.status = 'going'),
    (select count(*)::int from public.event_rsvps r where r.event_id = e.id and r.status = 'interested'),
    (select r.status from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()),
    e.created_by = auth.uid() or public.is_admin()
      or (e.society_id is not null and public.is_society_admin(e.society_id))
  from public.events e
  left join public.societies s on s.id = e.society_id
  where public.is_verified() and e.university_id = public.my_university_id()
    and e.ends_at > now()
    and (e.society_id is not null or not public.person_hidden(e.created_by))
    and (p_society is null or e.society_id = p_society)
    and (not p_mine or exists (select 1 from public.event_rsvps r
                               where r.event_id = e.id and r.user_id = auth.uid()))
  order by e.starts_at
  limit 100;
$$;

drop policy resources_read on public.resources;
create policy resources_read on public.resources for select to authenticated
  using (uploader_id = (select auth.uid())
         or ((select public.is_verified()) and status = 'published'
             and not public.person_hidden(uploader_id)
             and exists (select 1 from public.courses c join public.departments d on d.id = c.department_id
                         where c.id = course_id and d.university_id = (select public.my_university_id()))));

-- AIBuddy answers from the same files, so it mustn't quote hidden ones.
create or replace function public.search_course_chunks(
  p_course uuid,
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_k int default 6
) returns table (chunk_id uuid, resource_id uuid, resource_title text, resource_kind text,
                 page int, content text, score double precision)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select 1 as ok
    where public.is_verified() and exists (
      select 1 from public.courses c join public.departments d on d.id = c.department_id
      where c.id = p_course and d.university_id = public.my_university_id())
  ),
  usable as (
    select ch.* from public.resource_chunks ch
    join public.resources r on r.id = ch.resource_id
    where ch.course_id = p_course and r.status = 'published' and exists (select 1 from allowed)
      and not public.person_hidden(r.uploader_id)
  ),
  by_meaning as (
    select u.id, row_number() over (order by u.embedding operator(extensions.<=>) p_embedding) as rnk
    from usable u
    where p_embedding is not null and u.embedding is not null
    order by u.embedding operator(extensions.<=>) p_embedding
    limit 20
  ),
  by_words as (
    select u.id, row_number() over (order by ts_rank(u.fts, q) desc) as rnk
    from usable u, websearch_to_tsquery('english', coalesce(p_query, '')) q
    where u.fts @@ q
    order by ts_rank(u.fts, q) desc
    limit 20
  ),
  fused as (
    select id, sum(1.0 / (60 + rnk)) as score
    from (select * from by_meaning union all select * from by_words) x
    group by id
  )
  select ch.id, ch.resource_id, r.title, r.kind, ch.page, ch.content, f.score::double precision
  from fused f
  join public.resource_chunks ch on ch.id = f.id
  join public.resources r on r.id = ch.resource_id
  order by f.score desc, ch.id
  limit least(greatest(p_k, 1), 10);
$$;

-- The feed picks a page of ids before reading them, so hidden authors must be skipped here too,
-- or a banned spammer's posts could fill a page and end the feed early.
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
  v_me uuid := auth.uid();
  v_uni uuid;
  v_dept uuid;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_ids uuid[];
begin
  select university_id, department_id into v_uni, v_dept from public.profiles
  where id = v_me and verification_status = 'verified' and banned_at is null and deleted_at is null;
  if v_uni is null or not (p_space = 'campus' or p_space = 'department:' || v_dept::text) then
    return;
  end if;

  if p_sort = 'new' then
    select array_agg(id order by created_at desc, id desc) into v_ids from (
      select p.id, p.created_at from public.posts p
      where p.university_id = v_uni and p.space = p_space
        and (p.status = 'published' or (p.status = 'held' and p.author_id = v_me))
        and (p_after_id is null or (p.created_at, p.id) < (p_after_created, p_after_id))
        and not public.person_hidden(p.author_id)
        and not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me))
        and not exists (select 1 from public.hidden_posts h
                        where h.user_id = v_me and h.post_id = p.id)
        and (p.is_anonymous or not exists (select 1 from public.mutes m
                                           where m.muter_id = v_me and m.muted_id = p.author_id))
      order by p.created_at desc, p.id desc
      limit v_limit) page;
    return query select v.* from public.posts_public v where v.id = any (v_ids)
      order by v.created_at desc, v.id desc;
  else
    select array_agg(id order by hot_score desc, id desc) into v_ids from (
      select p.id, p.hot_score from public.posts p
      where p.university_id = v_uni and p.space = p_space
        and (p.status = 'published' or (p.status = 'held' and p.author_id = v_me))
        and (p_after_id is null or (p.hot_score, p.id) < (p_after_score, p_after_id))
        and not public.person_hidden(p.author_id)
        and not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me))
        and not exists (select 1 from public.hidden_posts h
                        where h.user_id = v_me and h.post_id = p.id)
        and (p.is_anonymous or not exists (select 1 from public.mutes m
                                           where m.muter_id = v_me and m.muted_id = p.author_id))
      order by p.hot_score desc, p.id desc
      limit v_limit) page;
    return query select v.* from public.posts_public v where v.id = any (v_ids)
      order by v.hot_score desc, v.id desc;
  end if;
end;
$fn$;

-- ---------- chats: only active, verified students can read theirs ----------
-- is_member also guards chat photos and live updates.
create or replace function public.is_member(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_verified() and exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

create or replace function public.my_conversation_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(conversation_id), '{}') from public.conversation_members
  where user_id = auth.uid() and public.is_verified();
$$;

create or replace function public.my_conversations(p_only uuid default null)
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
  where me.user_id = auth.uid() and public.is_verified()
    and (p_only is null or c.id = p_only)
    and (c.kind not in ('dm', 'ping') or (o.id is not null and not public.blocked_between(auth.uid(), o.id)))
    and (c.kind <> 'dm' or lm.id is not null or me.accepted_at is not null)
    and (p_only is not null or me.hidden_at is null or lm.created_at > me.hidden_at)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- ---------- banning: sign them out and stop their push notifications ----------
create or replace function public.ban_user(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_user;
  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if v_role = 'admin' or p_user = auth.uid() then
    raise exception 'Admins can''t be banned here' using errcode = '22023';
  end if;
  update public.profiles set banned_at = now() where id = p_user and banned_at is null;
  update public.reports set status = 'actioned', handled_by = auth.uid(), handled_at = now()
  where target_type = 'profile' and target_id = p_user and status = 'open';
  -- Push previews could otherwise keep showing them chat messages.
  delete from public.push_subscriptions where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
  perform public.audit('user.ban', 'profile', p_user, null, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

-- ---------- Admin → People: take verification away ----------
-- They go back to the "we couldn't verify you" screen, see the reason, and can try again.
create or replace function public.revoke_verification(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Say why, so the student knows' using errcode = '22023';
  end if;
  select * into v_me from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if v_me.role = 'admin' then
    raise exception 'Admins can''t be revoked here' using errcode = '22023';
  end if;
  if v_me.verification_status <> 'verified' then
    raise exception 'This student isn''t verified' using errcode = '22023';
  end if;

  update public.profiles set verification_status = 'rejected', verified_at = null where id = p_user;
  insert into public.verification_requests
    (user_id, university_id, status, reviewer_id, decision_reason, decided_at)
  values (p_user, v_me.university_id, 'rejected', auth.uid(), trim(p_reason), now());
  delete from public.push_subscriptions where user_id = p_user;
  perform public.audit('user.verification_revoked', 'profile', p_user,
    jsonb_build_object('method', v_me.verification_method, 'verified_at', v_me.verified_at),
    jsonb_build_object('reason', trim(p_reason)));
end;
$$;
revoke execute on function public.revoke_verification(uuid, text) from public, anon;
grant execute on function public.revoke_verification(uuid, text) to authenticated;
