-- Reports could go nowhere: reported chats never reached the queue, staff couldn't see reported
-- photos, and a reported message couldn't be removed. The queue now covers chats (with their
-- recent messages, for admins only) and says which files belong to each item. Removing a message
-- erases it for everyone; the audit log keeps a copy, which only admins can read.

drop function public.moderation_queue();
create function public.moderation_queue()
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
         coalesce(o.details, '{}'), o.last_at, i.preview, i.space, i.author_id,
         a.full_name, a.handle::text, i.is_anonymous, i.media_bucket, coalesce(i.media_paths, '{}')
  from items i
  left join open_reports o on o.target_type = i.target_type and o.target_id = i.target_id
  left join public.profiles a on a.id = i.author_id
  where public.is_staff()
    and (public.is_admin()
         or (i.target_type in ('post', 'comment') and public.can_moderate(i.university_id, i.space)))
  order by coalesce(o.n, 0) desc, o.last_at desc nulls last
  limit 200;
$$;
revoke execute on function public.moderation_queue() from public, anon;
grant execute on function public.moderation_queue() to authenticated;

-- You can report a chat only if you're in it.
create or replace function public.report(
  p_target_type text, p_target_id uuid, p_reason text, p_details text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target_type = 'message' and not exists (
    select 1 from public.messages where id = p_target_id and public.is_member(conversation_id)
  ) then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'conversation' and not public.is_member(p_target_id) then
    raise exception 'Chat not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'post' and not exists (select 1 from public.posts_public where id = p_target_id) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'comment' and not exists (select 1 from public.comments_public where id = p_target_id) then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'resource' and not exists (
    select 1 from public.resources where id = p_target_id and status = 'published'
  ) then
    raise exception 'File not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'listing' and not exists (select 1 from public.listings where id = p_target_id) then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'ride' and not exists (select 1 from public.rides where id = p_target_id) then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'event' and not exists (select 1 from public.events where id = p_target_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  on conflict do nothing;
end;
$$;

-- Admins can also remove a chat message. It can't be restored: the text is gone from the chat.
create or replace function public.moderate_content(
  p_type text, p_id uuid, p_action text, p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_university uuid;
  v_space text;
  v_author uuid;
  v_before text;
  v_after text;
  v_copy jsonb := '{}';
begin
  if p_action not in ('hide', 'restore') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if p_type = 'post' then
    select university_id, space, author_id, status::text into v_university, v_space, v_author, v_before
    from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select p.university_id, p.space, c.author_id, c.status::text into v_university, v_space, v_author, v_before
    from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  elsif p_type = 'listing' then
    select university_id, null, user_id, status into v_university, v_space, v_author, v_before
    from public.listings where id = p_id;
  elsif p_type = 'resource' then
    select d.university_id, null, r.uploader_id, r.status::text into v_university, v_space, v_author, v_before
    from public.resources r join public.courses c on c.id = r.course_id
    join public.departments d on d.id = c.department_id where r.id = p_id;
  elsif p_type = 'ride' then
    select university_id, null, user_id, status into v_university, v_space, v_author, v_before
    from public.rides where id = p_id;
  elsif p_type = 'event' then
    select university_id, null, created_by, status into v_university, v_space, v_author, v_before
    from public.events where id = p_id;
  elsif p_type = 'message' then
    -- Some chats have no university of their own; the sender's works for finding the row.
    select coalesce(c.university_id, s.university_id), null, m.sender_id,
           case when m.deleted_at is null then 'published' else 'removed' end,
           jsonb_build_object('body', m.body, 'attachment_path', m.attachment_path)
      into v_university, v_space, v_author, v_before, v_copy
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    left join public.profiles s on s.id = m.sender_id
    where m.id = p_id;
  else
    raise exception 'That can''t be moderated here' using errcode = '22023';
  end if;
  if v_university is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or (p_type in ('post', 'comment') and public.can_moderate(v_university, v_space))) then
    raise exception 'You can''t moderate this' using errcode = '42501';
  end if;

  if p_type = 'post' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.posts set status = v_after where id = p_id;
  elsif p_type = 'comment' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.comments set status = v_after where id = p_id;
  elsif p_type = 'listing' then
    v_after := case when p_action = 'hide' then 'removed' else 'active' end;
    update public.listings set status = v_after where id = p_id;
  elsif p_type = 'resource' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.resources set status = v_after where id = p_id;
  elsif p_type = 'ride' then
    v_after := case when p_action = 'hide' then 'cancelled' else 'open' end;
    update public.rides set status = v_after where id = p_id;
  elsif p_type = 'message' then
    if p_action = 'restore' then
      raise exception 'A removed message can''t be restored' using errcode = '22023';
    end if;
    v_after := 'removed';
    update public.messages set body = null, attachment_path = null, deleted_at = coalesce(deleted_at, now())
    where id = p_id;
  else
    v_after := case when p_action = 'hide' then 'cancelled' else 'active' end;
    update public.events set status = v_after where id = p_id;
  end if;

  update public.reports
     set status = case when p_action = 'hide' then 'actioned' else 'dismissed' end::public.report_status,
         handled_by = auth.uid(), handled_at = now()
   where target_type = p_type and target_id = p_id and status = 'open';
  if p_action = 'hide' then
    perform public.notify(v_author, 'content.removed', null, p_type, p_id,
                          jsonb_build_object('kind', p_type, 'reason', p_reason));
  end if;
  perform public.audit('content.' || p_action, p_type, p_id,
    jsonb_build_object('status', v_before) || v_copy,
    jsonb_build_object('status', v_after, 'reason', p_reason));
end;
$fn$;
