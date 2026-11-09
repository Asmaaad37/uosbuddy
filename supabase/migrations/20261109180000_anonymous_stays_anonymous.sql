-- Anonymous posts could be unmasked. Blocking someone hid their anonymous posts, so a vanishing
-- post named its author. A named comment on your own anonymous post carried an OP badge.
-- Moderators, who are fellow students, could read every author directly from the tables.
--
-- Now nobody gets an author through the API by accident: students and moderators can't, and
-- admins press Reveal, which is written to the audit log.

drop policy posts_staff on public.posts;
drop policy comments_staff on public.comments;

create or replace view public.posts_public with (security_barrier = true) as
select
  p.id, p.created_at, p.space, p.body, p.media_paths, p.poll, p.is_anonymous,
  p.upvotes, p.downvotes, p.comment_count, p.hot_score, p.status,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then null else a.handle::text end as author_handle,
  case when p.is_anonymous then al.alias else a.full_name end as author_name,
  case when not p.is_anonymous and public.visible_at(a.id, s.photo_visibility)
       then a.avatar_url end as author_avatar,
  p.author_id = auth.uid() as is_mine,
  (select value from public.post_votes v where v.post_id = p.id and v.user_id = auth.uid()) as my_vote,
  (select option from public.poll_votes v where v.post_id = p.id and v.user_id = auth.uid()) as my_poll_option,
  case when p.poll is not null then array(
    select count(pv.*)::int
    from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o
    left join public.poll_votes pv on pv.post_id = p.id and pv.option = o
    group by o order by o
  ) end as poll_counts,
  case when p.is_anonymous then null else d.short_code end as author_department_code,
  case when p.is_anonymous then null else a.batch_year end as author_batch_year
from public.posts p
join public.profiles a on a.id = p.author_id
join public.privacy_settings s on s.user_id = a.id
left join public.departments d on d.id = a.department_id
left join public.anon_aliases al on al.post_id = p.id and al.user_id = p.author_id
where public.can_see_space(p.university_id, p.space)
  and (p.status = 'published' or (p.status = 'held' and p.author_id = auth.uid()))
  and not public.person_hidden(p.author_id)
  -- Blocks hide named posts both ways. Not anonymous ones: if blocking someone made a post
  -- disappear, you'd know they wrote it.
  and (p.is_anonymous or not public.blocked_with(p.author_id));

create or replace view public.comments_public with (security_barrier = true) as
select
  c.id, c.created_at, c.post_id, c.parent_id, c.body, c.is_anonymous, c.status,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then null else a.handle::text end as author_handle,
  case when c.is_anonymous then al.alias else a.full_name end as author_name,
  case when not c.is_anonymous and public.visible_at(a.id, s.photo_visibility)
       then a.avatar_url end as author_avatar,
  c.author_id = auth.uid() as is_mine,
  -- "OP" marks the post's author in an anonymous thread without naming them. Only there: on
  -- a named comment or a named post it would tie the two together.
  c.is_anonymous and p.is_anonymous and c.author_id = p.author_id as is_op
from public.comments c
join public.posts p on p.id = c.post_id
join public.profiles a on a.id = c.author_id
join public.privacy_settings s on s.user_id = a.id
left join public.anon_aliases al on al.post_id = c.post_id and al.user_id = c.author_id
where public.can_see_space(p.university_id, p.space)
  and p.status = 'published' and c.status = 'published'
  and not public.person_hidden(c.author_id)
  and (c.is_anonymous or not public.blocked_with(c.author_id));

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
        and (p.is_anonymous or not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me)))
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
        and (p.is_anonymous or not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me)))
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

create or replace function public.create_comment(
  p_post uuid, p_body text, p_parent uuid default null, p_anonymous boolean default false,
  p_mod_token text default null, p_mod_status text default 'published'
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_post public.posts;
  v_parent_author uuid;
  v_id uuid;
  v_actor uuid;
  v_status text;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.posts_public where id = p_post and status = 'published') then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_anonymous and not public.flag('anonymous_posts') then
    raise exception 'Anonymous comments are switched off' using errcode = '42501';
  end if;
  v_status := public.moderation_status(p_body, p_mod_token, p_mod_status);
  if (select count(*) from public.comments
      where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''re commenting very fast. Take a break.' using errcode = '54000';
  end if;
  select * into v_post from public.posts where id = p_post;
  -- Your own name under your own anonymous post would give you away.
  if v_post.is_anonymous and v_post.author_id = auth.uid() then
    p_anonymous := true;
  end if;
  if p_parent is not null then
    select author_id into v_parent_author from public.comments
    where id = p_parent and post_id = p_post and status = 'published';
    if v_parent_author is null then
      raise exception 'Comment not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.comments (post_id, author_id, parent_id, body, is_anonymous, status)
  values (p_post, auth.uid(), p_parent, trim(p_body), p_anonymous, v_status)
  returning id into v_id;
  if v_status <> 'published' then
    return v_id;
  end if;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  if p_anonymous then
    perform public.alias_for(p_post, auth.uid());
  end if;

  v_actor := case when p_anonymous then null else auth.uid() end;
  perform public.notify(v_post.author_id, 'post.comment', v_actor, 'post', p_post,
                        jsonb_build_object('preview', left(trim(p_body), 80)));
  if v_parent_author is not null and v_parent_author <> v_post.author_id then
    perform public.notify(v_parent_author, 'comment.reply', v_actor, 'post', p_post,
                          jsonb_build_object('preview', left(trim(p_body), 80)));
  end if;
  return v_id;
end;
$fn$;

create or replace function public.moderation_queue()
returns table (target_type text, target_id uuid, status text, report_count int, reasons text[],
               details text[], last_reported_at timestamptz, preview text, space text,
               author_id uuid, author_name text, author_handle text, is_anonymous boolean,
               media_bucket text, media_paths text[])
language sql stable security definer set search_path = '' as $$
  with open_reports as (
    select r.target_type, r.target_id, count(*)::int as n, array_agg(distinct r.reason) as reasons,
           array_remove(array_agg(r.details), null) as details, max(r.created_at) as last_at
    from public.reports r where r.status = 'open'
    group by r.target_type, r.target_id
  ),
  items as (
    select 'post'::text as target_type, p.id as target_id, p.status::text as status,
           left(p.body, 400) as preview, p.space, p.author_id, p.is_anonymous, p.university_id,
           'post-media'::text as media_bucket, p.media_paths as media_paths
    from public.posts p
    where p.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'post' and o.target_id = p.id)
    union all
    select 'comment', c.id, c.status::text, left(c.body, 400), p.space, c.author_id, c.is_anonymous, p.university_id,
           null, null
    from public.comments c join public.posts p on p.id = c.post_id
    where c.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'comment' and o.target_id = c.id)
    union all
    select 'listing', l.id, l.status, left(l.title || E'\n' || l.description, 400), null, l.user_id, false, l.university_id,
           'listing-media', l.media_paths
    from public.listings l
    where l.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'listing' and o.target_id = l.id)
    union all
    select 'resource', r.id, r.status::text, r.title, null, r.uploader_id, false, d.university_id,
           'course-resources', array[r.file_path]
    from public.resources r join public.courses c on c.id = r.course_id
    join public.departments d on d.id = c.department_id
    where r.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'resource' and o.target_id = r.id)
    union all
    select 'ride', ri.id, ri.status, ri.from_area || ' → ' || ri.to_area || coalesce(E'\n' || ri.notes, ''),
           null, ri.user_id, false, ri.university_id, null, null
    from public.rides ri
    where exists (select 1 from open_reports o where o.target_type = 'ride' and o.target_id = ri.id)
    union all
    select 'event', e.id, e.status, e.title || E'\n' || e.description, null, e.created_by, false, e.university_id,
           null, null
    from public.events e
    where exists (select 1 from open_reports o where o.target_type = 'event' and o.target_id = e.id)
    union all
    select 'message', m.id, case when m.deleted_at is null then 'published' else 'removed' end,
           left(m.body, 400), null, m.sender_id, false, c.university_id,
           'chat-attachments', array_remove(array[m.attachment_path], null)
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where exists (select 1 from open_reports o where o.target_type = 'message' and o.target_id = m.id)
    union all
    select 'conversation', co.id, 'published',
           left(coalesce(co.title, 'Chat') || E'\n\n' || coalesce(recent.lines, ''), 1500),
           null, co.created_by, false, co.university_id, 'chat-attachments', recent.photos
    from public.conversations co
    cross join lateral (
      select string_agg(coalesce(a.full_name, 'Someone') || ': ' ||
               case when last5.deleted_at is not null then '(deleted)'
                    else coalesce(last5.body, '(photo)') end,
               E'\n' order by last5.created_at) as lines,
             coalesce(array_agg(last5.attachment_path) filter (where last5.attachment_path is not null), '{}') as photos
      from (select * from public.messages m where m.conversation_id = co.id
            order by m.created_at desc, m.id desc limit 5) last5
      left join public.profiles a on a.id = last5.sender_id
    ) recent
    where exists (select 1 from open_reports o where o.target_type = 'conversation' and o.target_id = co.id)
    union all
    -- A public address, not a storage path: the page shows it as it is.
    select 'profile', pr.id, case when pr.banned_at is null then 'active' else 'banned' end,
           coalesce(pr.bio, ''), null, pr.id, false, pr.university_id,
           'url', array_remove(array[pr.avatar_url], null)
    from public.profiles pr
    where exists (select 1 from open_reports o where o.target_type = 'profile' and o.target_id = pr.id)
  )
  select i.target_type, i.target_id, i.status, coalesce(o.n, 0), coalesce(o.reasons, '{}'),
         coalesce(o.details, '{}'), o.last_at, i.preview, i.space,
         case when not i.is_anonymous then i.author_id end,
         case when not i.is_anonymous then a.full_name end,
         case when not i.is_anonymous then a.handle::text end,
         i.is_anonymous, i.media_bucket, coalesce(i.media_paths, '{}')
  from items i
  left join open_reports o on o.target_type = i.target_type and o.target_id = i.target_id
  left join public.profiles a on a.id = i.author_id
  where public.is_staff()
    and (public.is_admin()
         or (i.target_type in ('post', 'comment') and public.can_moderate(i.university_id, i.space)))
  order by coalesce(o.n, 0) desc, o.last_at desc nulls last
  limit 200;
$$;

create or replace function public.warn_user(p_user uuid, p_message text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_message, ''))) < 5 then
    raise exception 'Say what the warning is about' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if not public.is_admin()
     and not exists (select 1 from public.posts p
                     where p.author_id = p_user and not p.is_anonymous
                       and public.can_moderate(p.university_id, p.space))
     and not exists (select 1 from public.comments c join public.posts p on p.id = c.post_id
                     where c.author_id = p_user and not c.is_anonymous
                       and public.can_moderate(p.university_id, p.space)) then
    raise exception 'You can only warn students who posted in your feeds' using errcode = '42501';
  end if;
  perform public.notify(p_user, 'account.warning', null, null, null,
                        jsonb_build_object('message', left(trim(p_message), 500)));
  perform public.audit('user.warn', 'profile', p_user, null, jsonb_build_object('message', trim(p_message)));
end;
$$;

-- Admin → Reports: who wrote this anonymous post or comment. Every look is on record.
create function public.reveal_anonymous_author(p_type text, p_id uuid)
returns table (id uuid, full_name text, handle text)
language plpgsql security definer set search_path = '' as $fn$
declare
  v_author uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_type = 'post' then
    select p.author_id into v_author from public.posts p where p.id = p_id and p.is_anonymous;
  elsif p_type = 'comment' then
    select c.author_id into v_author from public.comments c where c.id = p_id and c.is_anonymous;
  end if;
  if v_author is null then
    raise exception 'That isn''t anonymous' using errcode = '22023';
  end if;
  perform public.audit('content.reveal_author', p_type, p_id);
  return query select a.id, a.full_name, a.handle::text from public.profiles a where a.id = v_author;
end;
$fn$;
revoke execute on function public.reveal_anonymous_author(text, uuid) from public, anon;
grant execute on function public.reveal_anonymous_author(text, uuid) to authenticated;
