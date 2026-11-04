-- Phase 9: trust, admin and engagement. Every admin and moderator action goes through a
-- security-definer function that writes audit_log. Also: activity for DAU/WAU, account
-- deletion with a 14-day grace, data export, badges, the monthly Backup Hero board,
-- guidelines acceptance and the weekly digest's opt-out.

alter table public.profiles add column if not exists guidelines_accepted_at timestamptz;
alter table public.notification_prefs add column if not exists digest boolean not null default true;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded'
));

-- The one way admin and moderator actions are recorded.
create or replace function public.audit(
  p_action text, p_target_type text, p_target_id uuid, p_before jsonb default null,
  p_after jsonb default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_before, p_after);
$$;

-- ===========================================================================
-- Activity (DAU / WAU / retention). The app calls touch_activity() once a day per browser.
-- ===========================================================================
create table public.activity_days (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  primary key (user_id, day)
);
create index activity_days_day_idx on public.activity_days (day);
alter table public.activity_days enable row level security;
revoke all on public.activity_days from anon, authenticated;
grant all on public.activity_days to service_role;

create or replace function public.touch_activity() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.activity_days (user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Karachi')::date)
  on conflict do nothing;
  update public.profiles set last_active_at = now()
  where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '1 hour');
end;
$$;

-- ===========================================================================
-- Student moderators: scoped to feed spaces ('campus' or 'department:{id}').
-- ===========================================================================
create table public.moderator_scopes (
  user_id uuid not null references public.profiles on delete cascade,
  space text not null check (space ~ '^(campus|department:[0-9a-f-]{36})$'),
  granted_by uuid references public.profiles on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, space)
);
alter table public.moderator_scopes enable row level security;
create policy moderator_scopes_read on public.moderator_scopes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.moderator_scopes from anon, authenticated;
grant select on public.moderator_scopes to authenticated;
grant all on public.moderator_scopes to service_role;

-- Admins moderate everything; moderators only their spaces (at their own university).
create or replace function public.can_moderate(p_university uuid, p_space text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
    join public.moderator_scopes s on s.user_id = p.id
    where p.id = auth.uid() and p.role = 'moderator' and p.banned_at is null
      and p.university_id = p_university and s.space = p_space
  );
$$;

create or replace function public.set_moderator(p_user uuid, p_spaces text[]) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_before jsonb;
  v_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_user;
  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if v_role = 'admin' then
    raise exception 'Admins already moderate everything' using errcode = '22023';
  end if;
  select jsonb_build_object('role', v_role, 'spaces',
         coalesce((select jsonb_agg(space order by space) from public.moderator_scopes where user_id = p_user), '[]'))
    into v_before;
  delete from public.moderator_scopes where user_id = p_user;
  insert into public.moderator_scopes (user_id, space, granted_by)
  select p_user, s, auth.uid() from unnest(coalesce(p_spaces, '{}')) s;
  update public.profiles
     set role = case when cardinality(coalesce(p_spaces, '{}')) > 0 then 'moderator' else 'student' end::public.user_role
   where id = p_user;
  perform public.audit('moderator.set', 'profile', p_user, v_before,
    jsonb_build_object('spaces', to_jsonb(coalesce(p_spaces, '{}'))));
end;
$fn$;

-- ===========================================================================
-- The moderation queue: reported or held content the caller may act on, with context.
-- ===========================================================================
create or replace function public.moderation_queue()
returns table (target_type text, target_id uuid, status text, report_count int, reasons text[],
               details text[], last_reported_at timestamptz, preview text, space text,
               author_id uuid, author_name text, author_handle text, is_anonymous boolean)
language sql stable security definer set search_path = '' as $$
  with open_reports as (
    select r.target_type, r.target_id, count(*)::int as n, array_agg(distinct r.reason) as reasons,
           array_remove(array_agg(r.details), null) as details, max(r.created_at) as last_at
    from public.reports r where r.status = 'open'
    group by r.target_type, r.target_id
  ),
  items as (
    select 'post'::text as target_type, p.id as target_id, p.status::text as status,
           left(p.body, 400) as preview, p.space, p.author_id, p.is_anonymous, p.university_id
    from public.posts p
    where p.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'post' and o.target_id = p.id)
    union all
    select 'comment', c.id, c.status::text, left(c.body, 400), p.space, c.author_id, c.is_anonymous, p.university_id
    from public.comments c join public.posts p on p.id = c.post_id
    where c.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'comment' and o.target_id = c.id)
    union all
    select 'listing', l.id, l.status, left(l.title || E'\n' || l.description, 400), null, l.user_id, false, l.university_id
    from public.listings l
    where l.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'listing' and o.target_id = l.id)
    union all
    select 'resource', r.id, r.status::text, r.title, null, r.uploader_id, false, d.university_id
    from public.resources r join public.courses c on c.id = r.course_id
    join public.departments d on d.id = c.department_id
    where r.status = 'held' or exists (select 1 from open_reports o where o.target_type = 'resource' and o.target_id = r.id)
    union all
    select 'ride', ri.id, ri.status, ri.from_area || ' → ' || ri.to_area || coalesce(E'\n' || ri.notes, ''),
           null, ri.user_id, false, ri.university_id
    from public.rides ri
    where exists (select 1 from open_reports o where o.target_type = 'ride' and o.target_id = ri.id)
    union all
    select 'event', e.id, e.status, e.title || E'\n' || e.description, null, e.created_by, false, e.university_id
    from public.events e
    where exists (select 1 from open_reports o where o.target_type = 'event' and o.target_id = e.id)
    union all
    select 'message', m.id, 'published', left(m.body, 400), null, m.sender_id, false, c.university_id
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where exists (select 1 from open_reports o where o.target_type = 'message' and o.target_id = m.id)
    union all
    select 'profile', pr.id, case when pr.banned_at is null then 'active' else 'banned' end,
           coalesce(pr.bio, ''), null, pr.id, false, pr.university_id
    from public.profiles pr
    where exists (select 1 from open_reports o where o.target_type = 'profile' and o.target_id = pr.id)
  )
  select i.target_type, i.target_id, i.status, coalesce(o.n, 0), coalesce(o.reasons, '{}'),
         coalesce(o.details, '{}'), o.last_at, i.preview, i.space, i.author_id,
         a.full_name, a.handle::text, i.is_anonymous
  from items i
  left join open_reports o on o.target_type = i.target_type and o.target_id = i.target_id
  left join public.profiles a on a.id = i.author_id
  where public.is_staff()
    and (public.is_admin()
         or (i.target_type in ('post', 'comment') and public.can_moderate(i.university_id, i.space)))
  order by coalesce(o.n, 0) desc, o.last_at desc nulls last
  limit 200;
$$;

-- Hide (remove) or restore content; resolves its open reports. Moderators: posts and
-- comments in their spaces; admins: everything.
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
    jsonb_build_object('status', v_before), jsonb_build_object('status', v_after, 'reason', p_reason));
end;
$fn$;

-- Close a target's open reports without action.
create or replace function public.dismiss_reports(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_university uuid;
  v_space text;
begin
  if p_type = 'post' then
    select university_id, space into v_university, v_space from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select p.university_id, p.space into v_university, v_space
    from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  end if;
  if not (public.is_admin() or (v_university is not null and public.can_moderate(v_university, v_space))) then
    raise exception 'You can''t moderate this' using errcode = '42501';
  end if;
  update public.reports set status = 'dismissed', handled_by = auth.uid(), handled_at = now()
  where target_type = p_type and target_id = p_id and status = 'open';
  perform public.audit('reports.dismiss', p_type, p_id);
end;
$fn$;

-- ===========================================================================
-- Admin: people (search, warn, ban, unban), flags and the catalogue.
-- ===========================================================================
create or replace function public.admin_search_users(p_query text default null)
returns table (id uuid, full_name text, handle text, avatar_url text, role text,
               verification_status text, banned_at timestamptz, deleted_at timestamptz,
               created_at timestamptz, department text, batch_year int, email text,
               open_reports int, last_active_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.handle::text, p.avatar_url, p.role::text,
         p.verification_status::text, p.banned_at, p.deleted_at, p.created_at, d.short_code,
         p.batch_year, coalesce(pp.personal_email, pp.uni_email)::text,
         (select count(*)::int from public.reports r
          where r.target_type = 'profile' and r.target_id = p.id and r.status = 'open'),
         p.last_active_at
  from public.profiles p
  left join public.private_profile pp on pp.user_id = p.id
  left join public.departments d on d.id = p.department_id
  where public.is_admin()
    and (p_query is null or trim(p_query) = ''
         or p.full_name ilike '%' || trim(p_query) || '%'
         or p.handle::text ilike '%' || trim(p_query) || '%'
         or pp.personal_email::text ilike '%' || trim(p_query) || '%'
         or pp.uni_email::text ilike '%' || trim(p_query) || '%'
         or pp.roll_no ilike '%' || trim(p_query) || '%')
  order by (p_query is null or trim(p_query) = '') desc, p.created_at desc
  limit 50;
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
  perform public.notify(p_user, 'account.warning', null, null, null,
                        jsonb_build_object('message', left(trim(p_message), 500)));
  perform public.audit('user.warn', 'profile', p_user, null, jsonb_build_object('message', trim(p_message)));
end;
$$;

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
  perform public.audit('user.ban', 'profile', p_user, null, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function public.unban_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.profiles set banned_at = null where id = p_user and banned_at is not null;
  if not found then
    raise exception 'They aren''t banned' using errcode = '22023';
  end if;
  perform public.audit('user.unban', 'profile', p_user);
end;
$$;

create or replace function public.set_flag(p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_before boolean;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select enabled into v_before from public.feature_flags where key = p_key;
  if not found then
    raise exception 'Unknown flag' using errcode = 'P0002';
  end if;
  update public.feature_flags set enabled = p_enabled where key = p_key;
  perform public.audit('flag.set', 'feature_flag', null,
    jsonb_build_object('key', p_key, 'enabled', v_before), jsonb_build_object('key', p_key, 'enabled', p_enabled));
end;
$$;

-- Catalogue: add or edit a department / program; rename or remove a course.
create or replace function public.save_department(
  p_id uuid, p_name text, p_short_code text, p_faculty text default null, p_aliases text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid := p_id;
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.departments (university_id, name, short_code, faculty, aliases)
    values (public.my_university_id(), trim(p_name), upper(trim(p_short_code)), nullif(trim(p_faculty), ''),
            coalesce(p_aliases, '{}'))
    returning id into v_id;
  else
    select to_jsonb(d) into v_before from public.departments d where id = v_id;
    update public.departments
       set name = trim(p_name), short_code = upper(trim(p_short_code)),
           faculty = nullif(trim(p_faculty), ''), aliases = coalesce(p_aliases, '{}')
     where id = v_id;
    if not found then
      raise exception 'Department not found' using errcode = 'P0002';
    end if;
  end if;
  perform public.audit('catalogue.department', 'department', v_id, v_before,
    (select to_jsonb(d) from public.departments d where id = v_id));
  return v_id;
end;
$fn$;

create or replace function public.save_program(
  p_id uuid, p_department uuid, p_name text, p_level public.program_level, p_semesters int
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid := p_id;
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.programs (department_id, name, level, duration_semesters)
    values (p_department, trim(p_name), p_level, p_semesters)
    returning id into v_id;
  else
    select to_jsonb(p) into v_before from public.programs p where id = v_id;
    update public.programs
       set department_id = p_department, name = trim(p_name), level = p_level, duration_semesters = p_semesters
     where id = v_id;
    if not found then
      raise exception 'Program not found' using errcode = 'P0002';
    end if;
  end if;
  perform public.audit('catalogue.program', 'program', v_id, v_before,
    (select to_jsonb(p) from public.programs p where id = v_id));
  return v_id;
end;
$fn$;

create or replace function public.save_course(p_id uuid, p_code text, p_title text) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select to_jsonb(c) into v_before from public.courses c where id = p_id;
  if v_before is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  update public.courses set code = trim(p_code), title = trim(p_title) where id = p_id;
  perform public.audit('catalogue.course', 'course', p_id, v_before,
    (select to_jsonb(c) from public.courses c where id = p_id));
end;
$fn$;

-- Remove a duplicate or bogus course; its files, groups and enrolments go with it.
create or replace function public.delete_course(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select to_jsonb(c) into v_before from public.courses c where id = p_id;
  if v_before is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  delete from public.courses where id = p_id;
  perform public.audit('catalogue.course.delete', 'course', p_id, v_before, null);
end;
$fn$;

-- ===========================================================================
-- KPIs: a materialised daily table refreshed hourly, plus a few live numbers.
-- ===========================================================================
create materialized view public.admin_daily_stats as
with days as (
  select generate_series((now() at time zone 'Asia/Karachi')::date - 89,
                         (now() at time zone 'Asia/Karachi')::date, interval '1 day')::date as day
)
select d.day,
  (select count(*) from public.profiles p
   where (p.created_at at time zone 'Asia/Karachi')::date = d.day)::int as signups,
  (select count(*) from public.profiles p
   where (p.verified_at at time zone 'Asia/Karachi')::date = d.day)::int as verified,
  (select count(*) from public.activity_days a where a.day = d.day)::int as active
from days d;
create unique index admin_daily_stats_day on public.admin_daily_stats (day);
revoke all on public.admin_daily_stats from anon, authenticated;
grant select on public.admin_daily_stats to service_role;

create or replace function public.refresh_admin_stats() returns void
language sql security definer set search_path = '' as $$
  refresh materialized view concurrently public.admin_daily_stats;
$$;
select cron.schedule('admin-stats', '7 * * * *', 'select public.refresh_admin_stats()');

create or replace function public.admin_kpis() returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(to_jsonb(s) order by s.day), '[]')
              from public.admin_daily_stats s where s.day > v_today - 30),
    'funnel', jsonb_build_object(
      'signed_up', (select count(*) from public.profiles),
      'submitted', (select count(distinct user_id) from public.verification_requests),
      'verified', (select count(*) from public.profiles where verification_status = 'verified'),
      'onboarded', (select count(*) from public.profiles
                    where verification_status = 'verified' and onboarding_step >= 4),
      'pending', (select count(*) from public.verification_requests where status = 'pending')),
    'dau', (select count(*) from public.activity_days where day = v_today),
    'wau', (select count(distinct user_id) from public.activity_days where day > v_today - 7),
    'mau', (select count(distinct user_id) from public.activity_days where day > v_today - 30),
    -- Weekly cohorts by verification week: share active 1, 2 and 4 weeks later.
    'cohorts', (select coalesce(jsonb_agg(c order by c.week), '[]') from (
      select date_trunc('week', p.verified_at at time zone 'Asia/Karachi')::date as week,
             count(*)::int as size,
             round(avg((exists (select 1 from public.activity_days a where a.user_id = p.id
                and a.day >= (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '7 days')::date
                and a.day < (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '14 days')::date))::int) * 100) as w1,
             round(avg((exists (select 1 from public.activity_days a where a.user_id = p.id
                and a.day >= (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '14 days')::date
                and a.day < (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '21 days')::date))::int) * 100) as w2,
             round(avg((exists (select 1 from public.activity_days a where a.user_id = p.id
                and a.day >= (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '28 days')::date
                and a.day < (date_trunc('week', p.verified_at at time zone 'Asia/Karachi') + interval '35 days')::date))::int) * 100) as w4
      from public.profiles p
      where p.verified_at > now() - interval '8 weeks'
      group by 1) c),
    'top_departments', (select coalesce(jsonb_agg(t order by t.students desc), '[]') from (
      select d.short_code, d.name, count(*)::int as students
      from public.profiles p join public.departments d on d.id = p.department_id
      where p.verification_status = 'verified'
      group by d.id order by 3 desc limit 8) t),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'held_posts', (select count(*) from public.posts where status = 'held')
  ) into v_result;
  return v_result;
end;
$fn$;

-- ===========================================================================
-- Badges and the monthly Backup Hero board.
-- ===========================================================================
create table public.badges (
  slug text primary key,
  name text not null,
  emoji text not null,
  description text not null,
  sort int not null default 0
);
alter table public.badges enable row level security;
create policy badges_read on public.badges for select to authenticated using (true);
revoke all on public.badges from anon, authenticated;
grant select on public.badges to authenticated;
grant all on public.badges to service_role;
insert into public.badges (slug, name, emoji, description, sort) values
  ('first-backup', 'First backup', '🛟', 'Helped a classmate through Backup', 10),
  ('backup-hero', 'Backup Hero', '🦸', 'Helped 10 classmates through Backup', 20),
  ('connector', 'Connector', '🤝', 'Made 10 connections', 30),
  ('note-sharer', 'Note sharer', '📚', 'Shared 3 files in course rooms', 40),
  ('mentor', 'Mentor', '🎓', 'Mentoring a junior', 50),
  ('society-lead', 'Society lead', '🎤', 'Runs a verified society', 60),
  ('driver', 'Driver', '🚗', 'Gave 3 students a lift', 70);

create table public.user_badges (
  user_id uuid not null references public.profiles on delete cascade,
  badge text not null references public.badges on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
create policy user_badges_read on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_verified()));
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
grant all on public.user_badges to service_role;

-- Hourly: award anything newly earned (idempotent), and tell the student.
create or replace function public.award_badges() returns int
language plpgsql security definer set search_path = '' as $fn$
declare
  v_count int;
begin
  with earned as (
    select b.claimed_by as user_id, 'first-backup' as badge
    from public.backup_requests b where b.status = 'resolved' and b.claimed_by is not null
    group by b.claimed_by
    union all
    select bp.user_id, 'backup-hero' from public.backup_points bp where bp.helped_count >= 10
    union all
    select u.id, 'connector' from public.profiles u
    where (select count(*) from public.connections c
           where c.status = 'accepted' and u.id in (c.requester_id, c.addressee_id)) >= 10
    union all
    select r.uploader_id, 'note-sharer' from public.resources r
    where r.status = 'published' and r.uploader_id is not null
    group by r.uploader_id having count(*) >= 3
    union all
    select m.mentor_id, 'mentor' from public.mentorships m where m.status = 'accepted' group by m.mentor_id
    union all
    select sm.user_id, 'society-lead' from public.society_members sm
    join public.societies s on s.id = sm.society_id
    where sm.role = 'admin' and s.verified group by sm.user_id
    union all
    select r.user_id, 'driver' from public.ride_requests q join public.rides r on r.id = q.ride_id
    where q.status = 'accepted' and r.kind = 'offer' group by r.user_id having count(*) >= 3
  ),
  added as (
    insert into public.user_badges (user_id, badge)
    select distinct e.user_id, e.badge from earned e
    join public.profiles p on p.id = e.user_id and p.deleted_at is null
    on conflict do nothing
    returning user_id, badge
  ),
  told as (
    select public.notify(a.user_id, 'badge.awarded', null, 'badge', null,
             jsonb_build_object('badge', a.badge, 'name', b.name, 'emoji', b.emoji))
    from added a join public.badges b on b.slug = a.badge
  )
  select count(*) into v_count from told;
  return v_count;
end;
$fn$;
select cron.schedule('award-badges', '20 * * * *', 'select public.award_badges()');

create or replace function public.profile_badges(p_user uuid)
returns table (slug text, name text, emoji text, description text, awarded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.slug, b.name, b.emoji, b.description, ub.awarded_at
  from public.user_badges ub join public.badges b on b.slug = ub.badge
  where ub.user_id = p_user
    and (p_user = auth.uid() or (public.is_verified() and public.visible_at(p_user,
         (select profile_visibility from public.privacy_settings where user_id = p_user))))
  order by b.sort;
$$;

-- This month (Pakistan time): who resolved the most Backup requests. Department or all UoS.
create or replace function public.backup_leaderboard(p_department_only boolean default false)
returns table (rank int, user_id uuid, full_name text, handle text, avatar_url text,
               department text, helped int)
language sql stable security definer set search_path = '' as $$
  with me as (select university_id, department_id from public.profiles where id = auth.uid()),
  month_start as (
    select (date_trunc('month', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi') as at
  ),
  counts as (
    select b.claimed_by as uid, count(*)::int as helped
    from public.backup_requests b, me, month_start m
    where b.status = 'resolved' and b.resolved_at >= m.at and b.university_id = me.university_id
      and b.claimed_by is not null
    group by b.claimed_by
  )
  select (rank() over (order by c.helped desc))::int, p.id, p.full_name, p.handle::text,
         public.shown_avatar(p.id), d.short_code, c.helped
  from counts c
  join public.profiles p on p.id = c.uid
  left join public.departments d on d.id = p.department_id, me
  where public.is_verified() and p.deleted_at is null and p.banned_at is null
    and (not p_department_only or p.department_id = me.department_id)
    and not public.blocked_with(p.id)
  order by c.helped desc, p.full_name
  limit 20;
$$;

-- ===========================================================================
-- Me → Data: export everything about me; delete my account (14-day grace).
-- ===========================================================================
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'private', (select to_jsonb(pp) from public.private_profile pp where pp.user_id = auth.uid()),
    'privacy', (select to_jsonb(s) from public.privacy_settings s where s.user_id = auth.uid()),
    'interests', (select coalesce(jsonb_agg(i.label), '[]') from public.profile_interests x
                  join public.interests i on i.id = x.interest_id where x.user_id = auth.uid()),
    'connections', (select coalesce(jsonb_agg(jsonb_build_object('with',
                      case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
                      'status', c.status, 'since', c.created_at)), '[]')
                    from public.connections c where auth.uid() in (c.requester_id, c.addressee_id)),
    'messages_sent', (select coalesce(jsonb_agg(jsonb_build_object('conversation', m.conversation_id,
                        'at', m.created_at, 'body', m.body)), '[]')
                      from public.messages m where m.sender_id = auth.uid()),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('at', p.created_at, 'space', p.space,
                'body', p.body, 'anonymous', p.is_anonymous, 'status', p.status)), '[]')
              from public.posts p where p.author_id = auth.uid()),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object('at', c.created_at, 'post', c.post_id,
                   'body', c.body)), '[]') from public.comments c where c.author_id = auth.uid()),
    'backup_requests', (select coalesce(jsonb_agg(jsonb_build_object('at', b.created_at, 'title', b.title,
                          'details', b.details, 'status', b.status)), '[]')
                        from public.backup_requests b where b.requester_id = auth.uid()),
    'listings', (select coalesce(jsonb_agg(jsonb_build_object('at', l.created_at, 'kind', l.kind,
                   'title', l.title, 'description', l.description, 'price_pkr', l.price_pkr)), '[]')
                 from public.listings l where l.user_id = auth.uid()),
    'rides', (select coalesce(jsonb_agg(jsonb_build_object('at', r.created_at, 'from', r.from_area,
                'to', r.to_area, 'depart_at', r.depart_at)), '[]') from public.rides r where r.user_id = auth.uid()),
    'event_rsvps', (select coalesce(jsonb_agg(jsonb_build_object('event', e.title, 'status', x.status)), '[]')
                    from public.event_rsvps x join public.events e on e.id = x.event_id where x.user_id = auth.uid()),
    'timetable', (select coalesce(jsonb_agg(jsonb_build_object('day', t.day, 'start_min', t.start_min,
                    'end_min', t.end_min, 'label', t.label, 'room', t.room)), '[]')
                  from public.timetable_slots t where t.user_id = auth.uid()),
    'ai_chats', (select coalesce(jsonb_agg(jsonb_build_object('title', t.title, 'messages',
                   (select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content) order by m.created_at)
                    from public.ai_messages m where m.thread_id = t.id))), '[]')
                 from public.ai_threads t where t.user_id = auth.uid()),
    'notifications', (select count(*) from public.notifications n where n.user_id = auth.uid()),
    'badges', (select coalesce(jsonb_agg(b.badge), '[]') from public.user_badges b where b.user_id = auth.uid())
  )
  where auth.uid() is not null;
$$;

-- Deactivates now (hidden everywhere: is_verified() checks deleted_at); purged after 14 days.
create or replace function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Log in first' using errcode = '42501';
  end if;
  update public.profiles set deleted_at = now() where id = auth.uid() and deleted_at is null;
  perform public.audit('account.delete_requested', 'profile', auth.uid());
  return (select deleted_at + interval '14 days' from public.profiles where id = auth.uid());
end;
$$;

create or replace function public.cancel_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set deleted_at = null
  where id = auth.uid() and deleted_at > now() - interval '14 days';
  if not found then
    raise exception 'Nothing to cancel' using errcode = 'P0002';
  end if;
  perform public.audit('account.delete_cancelled', 'profile', auth.uid());
end;
$$;

-- Daily: accounts past their grace period are deleted at the source (auth.users), which
-- cascades to the profile, private details, settings, and everything they own.
create or replace function public.purge_deleted_accounts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.profiles
  where deleted_at is not null and deleted_at <= now() - interval '14 days';
  if v_ids is null then
    return 0;
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  select null, 'account.purged', 'profile', unnest(v_ids);
  delete from auth.users where id = any (v_ids);
  return cardinality(v_ids);
end;
$$;
select cron.schedule('purge-deleted-accounts', '15 22 * * *', 'select public.purge_deleted_accounts()');

-- ===========================================================================
-- Community guidelines: accepted once, before a first post.
-- ===========================================================================
create or replace function public.accept_guidelines() returns void
language sql security definer set search_path = '' as $$
  update public.profiles set guidelines_accepted_at = now()
  where id = auth.uid() and guidelines_accepted_at is null;
$$;

-- ===========================================================================
-- Weekly digest (sent by the app's cron route with the service role).
-- ===========================================================================
create or replace function public.digest_recipients(p_limit int default 400)
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
  where p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
    and coalesce(np.digest, true)
    and coalesce(pp.personal_email, pp.uni_email) is not null
  order by p.last_active_at desc nulls last
  limit least(greatest(p_limit, 1), 1000);
$$;

-- One-click unsubscribe from the email link (the route verifies the signature first).
create or replace function public.set_digest(p_user uuid, p_on boolean) returns void
language sql security definer set search_path = '' as $$
  insert into public.notification_prefs (user_id, digest) values (p_user, p_on)
  on conflict (user_id) do update set digest = excluded.digest;
$$;

-- ===========================================================================
-- Permissions.
-- ===========================================================================
revoke execute on function public.audit(text, text, uuid, jsonb, jsonb),
  public.refresh_admin_stats(), public.purge_deleted_accounts(), public.award_badges(),
  public.digest_recipients(int), public.set_digest(uuid, boolean)
  from public, anon, authenticated;
revoke execute on function public.touch_activity(), public.can_moderate(uuid, text),
  public.set_moderator(uuid, text[]), public.moderation_queue(),
  public.moderate_content(text, uuid, text, text), public.dismiss_reports(text, uuid),
  public.admin_search_users(text), public.warn_user(uuid, text), public.ban_user(uuid, text),
  public.unban_user(uuid), public.set_flag(text, boolean),
  public.save_department(uuid, text, text, text, text[]),
  public.save_program(uuid, uuid, text, public.program_level, int),
  public.save_course(uuid, text, text), public.delete_course(uuid), public.admin_kpis(),
  public.export_my_data(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.profile_badges(uuid), public.backup_leaderboard(boolean), public.accept_guidelines()
  from public, anon;
grant execute on function public.touch_activity(), public.can_moderate(uuid, text),
  public.set_moderator(uuid, text[]), public.moderation_queue(),
  public.moderate_content(text, uuid, text, text), public.dismiss_reports(text, uuid),
  public.admin_search_users(text), public.warn_user(uuid, text), public.ban_user(uuid, text),
  public.unban_user(uuid), public.set_flag(text, boolean),
  public.save_department(uuid, text, text, text, text[]),
  public.save_program(uuid, uuid, text, public.program_level, int),
  public.save_course(uuid, text, text), public.delete_course(uuid), public.admin_kpis(),
  public.export_my_data(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.profile_badges(uuid), public.backup_leaderboard(boolean), public.accept_guidelines()
  to authenticated;
grant execute on function public.digest_recipients(int), public.set_digest(uuid, boolean)
  to service_role;
