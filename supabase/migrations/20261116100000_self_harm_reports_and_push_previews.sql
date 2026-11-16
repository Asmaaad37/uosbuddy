-- H5: with AI moderation off, reports are the only signal, and a report about self-harm waited
-- in line like spam. It now has its own reason and goes to the top of the queue.
-- H6: notification settings get "Show message text" (on by default); the push route reads it.

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'fake', 'inappropriate', 'self_harm', 'other'));

alter table public.notification_prefs add column previews boolean not null default true;

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
  -- Someone who may hurt themselves comes first, whatever else is waiting.
  order by 'self_harm' = any (coalesce(o.reasons, '{}')) desc,
           coalesce(o.n, 0) desc, o.last_at desc nulls last
  limit 200;
$$;
