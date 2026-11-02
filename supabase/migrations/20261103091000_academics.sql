-- Phase 6 (part 1): academics. Courses are added by students (normalised codes stop
-- duplicates), enrolment is per term, resources are shared files per course, timetables
-- stay private and only power free-window maths with connections, pings open 2-hour
-- chats, and seniors opt in as mentors. Every write goes through a function.

-- ===========================================================================
-- Terms: Fall Sep–Jan, Spring Feb–Jun, Summer Jul–Aug (Pakistan time).
-- ===========================================================================
create or replace function public.current_term() returns text
language sql stable set search_path = '' as $$
  with d as (select (now() at time zone 'Asia/Karachi')::date as today)
  select case
    when extract(month from today) = 1 then (extract(year from today)::int - 1) || '-fall'
    when extract(month from today) between 2 and 6 then extract(year from today)::int || '-spring'
    when extract(month from today) between 7 and 8 then extract(year from today)::int || '-summer'
    else extract(year from today)::int || '-fall'
  end
  from d;
$$;

-- ===========================================================================
-- Courses, added by students. "cs 301", "CS-301" and "CS301" are one course.
-- ===========================================================================
alter table public.courses
  add column if not exists code_norm text
    generated always as (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))) stored,
  add column if not exists created_by uuid references public.profiles on delete set null;
create unique index if not exists courses_dept_code_norm_uq on public.courses (department_id, code_norm);
create index if not exists courses_title_trgm_idx on public.courses
  using gin (lower(title) extensions.gin_trgm_ops);

-- Adds a course (or finds it). Returns its id.
create or replace function public.add_course(p_department uuid, p_code text, p_title text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(trim(p_code));
  v_norm text := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.departments
                 where id = p_department and university_id = public.my_university_id()) then
    raise exception 'Choose a department' using errcode = '22023';
  end if;
  if v_norm !~ '^[A-Z]{2,8}[0-9]{2,5}[A-Z]?$' then
    raise exception 'Use the course code from your timetable, like CS-301' using errcode = '22023';
  end if;
  select id into v_id from public.courses where department_id = p_department and code_norm = v_norm;
  if v_id is not null then
    return v_id;
  end if;
  if char_length(trim(p_title)) not between 3 and 120 then
    raise exception 'Add the course title, like Data Structures' using errcode = '22023';
  end if;
  if (select count(*) from public.courses
      where created_by = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s 10 new courses today. Try again tomorrow.' using errcode = '54000';
  end if;
  -- "CS301" → "CS-301" for display.
  v_code := regexp_replace(v_norm, '^([A-Z]+)([0-9].*)$', '\1-\2');
  insert into public.courses (department_id, code, title, created_by)
  values (p_department, v_code, trim(p_title), auth.uid())
  on conflict (department_id, code_norm) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.courses where department_id = p_department and code_norm = v_norm;
  end if;
  return v_id;
end;
$$;

-- ===========================================================================
-- Enrolments (§4.3)
-- ===========================================================================
create table public.enrollments (
  user_id uuid not null references public.profiles on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  term text not null check (term ~ '^[0-9]{4}-(fall|spring|summer)$'),
  section text check (char_length(section) <= 10),
  created_at timestamptz not null default now(),
  primary key (user_id, course_id, term)
);
create index enrollments_course_idx on public.enrollments (course_id, term);
alter table public.enrollments enable row level security;
create policy enrollments_own on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.enrollments from anon, authenticated;
grant select on public.enrollments to authenticated;
grant all on public.enrollments to service_role;

create or replace function public.join_course(p_course uuid, p_section text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses c join public.departments d on d.id = c.department_id
                 where c.id = p_course and d.university_id = public.my_university_id()) then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.enrollments
      where user_id = auth.uid() and term = public.current_term()) >= 12 then
    raise exception 'That''s 12 courses this term already' using errcode = '54000';
  end if;
  insert into public.enrollments (user_id, course_id, term, section)
  values (auth.uid(), p_course, public.current_term(), nullif(upper(trim(p_section)), ''))
  on conflict (user_id, course_id, term) do update set section = excluded.section;
end;
$$;

create or replace function public.leave_course(p_course uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.enrollments
  where user_id = auth.uid() and course_id = p_course and term = public.current_term();
$$;

-- A course with how many are taking it this term and whether the caller is.
create or replace function public.course_overview(p_course uuid)
returns table (id uuid, code text, title text, department_id uuid, department_code text,
               enrolled_count int, me_enrolled boolean, chat_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.code, c.title, c.department_id, d.short_code,
    (select count(*)::int from public.enrollments e
      where e.course_id = c.id and e.term = public.current_term()),
    exists (select 1 from public.enrollments e
      where e.course_id = c.id and e.user_id = auth.uid() and e.term = public.current_term()),
    (select cv.id from public.conversations cv
      where cv.course_id = c.id and cv.kind = 'course' and public.is_member(cv.id))
  from public.courses c join public.departments d on d.id = c.department_id
  where c.id = p_course and d.university_id = public.my_university_id() and public.is_verified();
$$;

-- Classmates in a course this term, as their privacy allows (only visible profiles).
create or replace function public.course_people(p_course uuid, p_limit int default 50)
returns table (id uuid, handle text, full_name text, avatar_url text, section text)
language sql stable security definer set search_path = '' as $$
  select pp.id, pp.handle::text, pp.full_name, pp.avatar_url, e.section
  from public.enrollments e
  join public.profiles_public pp on pp.id = e.user_id
  where e.course_id = p_course and e.term = public.current_term() and e.user_id <> auth.uid()
  order by lower(coalesce(pp.full_name, pp.handle::text))
  limit least(greatest(p_limit, 1), 100);
$$;

-- The caller's courses this term.
create or replace function public.my_courses()
returns table (id uuid, code text, title text, department_code text, section text,
               enrolled_count int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.code, c.title, d.short_code, e.section,
    (select count(*)::int from public.enrollments x
      where x.course_id = c.id and x.term = e.term)
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  join public.departments d on d.id = c.department_id
  where e.user_id = auth.uid() and e.term = public.current_term()
  order by c.code;
$$;

-- The course chat (one per course), opt-in for students taking it.
create unique index if not exists conversations_course_uq on public.conversations (course_id)
  where kind = 'course';
create or replace function public.join_course_chat(p_course uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_course record;
  v_id uuid;
begin
  if not exists (select 1 from public.enrollments
                 where user_id = auth.uid() and course_id = p_course and term = public.current_term()) then
    raise exception 'Join the course first' using errcode = '42501';
  end if;
  select c.code, c.title into v_course from public.courses c where c.id = p_course;
  insert into public.conversations (kind, university_id, title, course_id, created_by)
  values ('course', public.my_university_id(), left(v_course.code || ' · ' || v_course.title, 60),
          p_course, auth.uid())
  on conflict (course_id) where kind = 'course' do nothing;
  select id into v_id from public.conversations where course_id = p_course and kind = 'course';
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_id, auth.uid(), now()) on conflict do nothing;
  return v_id;
end;
$$;

-- ===========================================================================
-- Resources: shared files per course (PDF or image).
-- ===========================================================================
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  course_id uuid not null references public.courses on delete cascade,
  uploader_id uuid references public.profiles on delete set null,
  kind text not null check (kind in ('notes', 'past_paper', 'outline', 'slides', 'assignment')),
  title text not null check (char_length(title) between 3 and 120),
  file_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  year int check (year between 2000 and 2100),
  teacher_name text check (char_length(teacher_name) <= 80),
  term text,
  upvotes int not null default 0,
  -- 'pending_scan' is reserved for a virus scanner (worker) once one runs.
  status text not null default 'published'
    check (status in ('pending_scan', 'published', 'held', 'removed')),
  embedded_at timestamptz
);
create index resources_course_idx on public.resources (course_id, status, upvotes desc, created_at desc);

create table public.resource_votes (
  resource_id uuid not null references public.resources on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (resource_id, user_id)
);

alter table public.resources enable row level security;
alter table public.resource_votes enable row level security;
create policy resources_read on public.resources for select to authenticated
  using (uploader_id = (select auth.uid())
         or ((select public.is_verified()) and status = 'published'
             and exists (select 1 from public.courses c join public.departments d on d.id = c.department_id
                         where c.id = course_id and d.university_id = (select public.my_university_id()))));
create policy resource_votes_own on public.resource_votes for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.resources, public.resource_votes from anon, authenticated;
grant select on public.resources, public.resource_votes to authenticated;
grant all on public.resources, public.resource_votes to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-resources', 'course-resources', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy course_resources_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'course-resources' and (select public.is_verified())
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)\Z');
create policy course_resources_read on storage.objects for select to authenticated
  using (bucket_id = 'course-resources' and (select public.is_verified()));

create or replace function public.add_resource(
  p_course uuid, p_kind text, p_title text, p_path text, p_mime text, p_size int,
  p_year int default null, p_teacher text default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses c join public.departments d on d.id = c.department_id
                 where c.id = p_course and d.university_id = public.my_university_id()) then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if split_part(p_path, '/', 1) <> p_course::text then
    raise exception 'Upload the file again' using errcode = '22023';
  end if;
  if (select count(*) from public.resources
      where uploader_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 uploads today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.resources (course_id, uploader_id, kind, title, file_path, mime_type,
                                size_bytes, year, teacher_name, term)
  values (p_course, auth.uid(), p_kind, trim(p_title), p_path, p_mime, p_size, p_year,
          nullif(trim(p_teacher), ''), public.current_term())
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.vote_resource(p_resource uuid, p_up boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if not exists (select 1 from public.resources r where r.id = p_resource and r.status = 'published') then
    raise exception 'Resource not found' using errcode = 'P0002';
  end if;
  if p_up then
    insert into public.resource_votes (resource_id, user_id) values (p_resource, auth.uid())
    on conflict do nothing;
  else
    delete from public.resource_votes where resource_id = p_resource and user_id = auth.uid();
  end if;
  update public.resources
     set upvotes = (select count(*) from public.resource_votes where resource_id = p_resource)
   where id = p_resource
  returning upvotes into v_count;
  return v_count;
end;
$$;

create or replace function public.delete_resource(p_resource uuid) returns void
language sql security definer set search_path = '' as $$
  update public.resources set status = 'removed' where id = p_resource and uploader_id = auth.uid();
$$;

-- Reports can target resources (and pings, notifications below); 3 reports hold a file.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'message', 'conversation', 'post', 'comment', 'resource'));

create or replace function public.reports_hold_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open int;
begin
  if new.target_type not in ('post', 'comment', 'resource') then
    return new;
  end if;
  select count(*) into v_open from public.reports
  where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if new.target_type = 'post' then
    update public.posts set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  elsif new.target_type = 'comment' then
    update public.comments set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  else
    update public.resources set status = 'held'
    where id = new.target_id and status = 'published' and v_open >= 3;
  end if;
  return new;
end;
$$;

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
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  on conflict do nothing;
end;
$$;

-- ===========================================================================
-- Timetables: private slots; free windows only with connections who share.
-- ===========================================================================
alter table public.privacy_settings
  add column if not exists share_free_time boolean not null default true;

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  term text not null check (term ~ '^[0-9]{4}-(fall|spring|summer)$'),
  day smallint not null check (day between 0 and 6),          -- 0 = Monday
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  course_id uuid references public.courses on delete set null,
  label text not null check (char_length(label) between 1 and 60),
  room text check (char_length(room) <= 40),
  check (start_min < end_min)
);
create index timetable_slots_user_idx on public.timetable_slots (user_id, term, day);
alter table public.timetable_slots enable row level security;
create policy timetable_own on public.timetable_slots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.timetable_slots from anon, authenticated;
grant select, insert, update, delete on public.timetable_slots to authenticated;
grant all on public.timetable_slots to service_role;

-- Busy times for "Free together": the caller's own, plus connections who share theirs.
-- Times only (no course, room or label), so a timetable never leaks beyond "busy".
create or replace function public.busy_slots(p_users uuid[])
returns table (user_id uuid, day smallint, start_min smallint, end_min smallint)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.day, s.start_min, s.end_min
  from public.timetable_slots s
  join public.privacy_settings p on p.user_id = s.user_id
  where s.user_id = any(p_users) and s.term = public.current_term()
    and (s.user_id = auth.uid()
         or (p.share_free_time and public.are_connected(auth.uid(), s.user_id)
             and not public.blocked_between(auth.uid(), s.user_id)));
$$;

-- ===========================================================================
-- Who's free now: opted in (show_free_now), on campus right now, no class now.
-- ===========================================================================
create table public.presence (
  user_id uuid primary key references public.profiles on delete cascade,
  on_campus_until timestamptz not null
);
alter table public.presence enable row level security;
create policy presence_own on public.presence for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.presence from anon, authenticated;
grant select on public.presence to authenticated;
grant all on public.presence to service_role;

-- "I'm on campus" for a few hours (0 clears it).
create or replace function public.set_on_campus(p_hours int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_until timestamptz;
begin
  if p_hours <= 0 then
    delete from public.presence where user_id = auth.uid();
    return null;
  end if;
  v_until := now() + make_interval(hours => least(p_hours, 8));
  insert into public.presence (user_id, on_campus_until) values (auth.uid(), v_until)
  on conflict (user_id) do update set on_campus_until = excluded.on_campus_until;
  return v_until;
end;
$$;

create or replace function public.free_now(p_limit int default 30)
returns table (id uuid, handle text, full_name text, avatar_url text, department_id uuid,
               batch_year int, section text, free_until_min int)
language sql stable security definer set search_path = '' as $$
  with now_pk as (
    select (extract(isodow from now() at time zone 'Asia/Karachi')::int - 1) as day,
           (extract(hour from now() at time zone 'Asia/Karachi') * 60
            + extract(minute from now() at time zone 'Asia/Karachi'))::int as minute
  ),
  me as (select * from public.profiles where id = auth.uid())
  select pp.id, pp.handle::text, pp.full_name, pp.avatar_url, pp.department_id,
    pp.batch_year, pp.section,
    (select min(s.start_min)::int from public.timetable_slots s, now_pk n
      where s.user_id = pp.id and s.term = public.current_term()
        and s.day = n.day and s.start_min > n.minute)
  from public.presence pr
  join public.privacy_settings ps on ps.user_id = pr.user_id and ps.show_free_now
  join public.profiles_public pp on pp.id = pr.user_id
  cross join now_pk n
  cross join me
  where pr.on_campus_until > now() and pr.user_id <> auth.uid() and public.is_verified()
    and not exists (select 1 from public.timetable_slots s
                    where s.user_id = pr.user_id and s.term = public.current_term()
                      and s.day = n.day and n.minute >= s.start_min and n.minute < s.end_min)
  order by (pp.department_id = me.department_id and pp.batch_year = me.batch_year) desc,
           (pp.department_id = me.department_id) desc, pp.full_name
  limit least(greatest(p_limit, 1), 50);
$$;

-- ===========================================================================
-- Pings: "You free?" opens a 2-hour chat (respects allow_dms_from and blocks).
-- ===========================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted'
));

create or replace function public.wants(p_user uuid, p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case split_part(p_type, '.', 1)
      when 'connect' then p.connections
      when 'mentor' then p.connections
      when 'backup' then p.backup
      when 'post' then p.comments
      when 'comment' then p.comments
      when 'message' then p.messages
      when 'ping' then p.messages
      else true end
    from public.notification_prefs p where p.user_id = p_user
  ), true);
$$;

create or replace function public.send_ping(p_target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_allowed public.visibility_level;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target = v_me or public.blocked_between(v_me, p_target) or not public.can_view_profile(p_target) then
    raise exception 'You can''t ping this student' using errcode = '42501';
  end if;
  select allow_dms_from into v_allowed from public.privacy_settings where user_id = p_target;
  if not public.are_connected(v_me, p_target)
     and not public.visible_at(p_target, coalesce(v_allowed, 'everyone')) then
    raise exception 'This student only takes messages from some people' using errcode = '42501';
  end if;
  if (select count(*) from public.conversations
      where kind = 'ping' and created_by = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s 10 pings today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.conversations (kind, university_id, title, created_by, expires_at)
  values ('ping', public.my_university_id(), 'You free?', v_me, now() + interval '2 hours')
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_id, v_me, now()), (v_id, p_target, now());
  insert into public.messages (conversation_id, sender_id, body) values (v_id, v_me, 'You free? 👋');
  update public.conversations set last_message_at = now() where id = v_id;
  perform public.notify(p_target, 'ping', v_me, 'conversation', v_id);
  return v_id;
end;
$$;

-- Expired pings and temporary Backup chats are cleared a day after they end.
create or replace function public.backup_housekeeping() returns void
language sql security definer set search_path = '' as $$
  update public.backup_requests set status = 'expired', closed_at = now()
  where status = 'open' and expires_at < now();
  delete from public.conversations where kind = 'backup_temp' and expires_at < now();
  delete from public.conversations where kind = 'ping' and expires_at < now() - interval '1 day';
$$;

-- ===========================================================================
-- Study groups: a small group chat around a course (enrolled students only).
-- ===========================================================================
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  course_id uuid not null references public.courses on delete cascade,
  creator_id uuid references public.profiles on delete set null,
  title text not null check (char_length(title) between 3 and 60),
  meets text check (char_length(meets) <= 80),
  max_members int not null default 6 check (max_members between 2 and 12),
  conversation_id uuid not null references public.conversations on delete cascade
);
create index study_groups_course_idx on public.study_groups (course_id, created_at desc);
alter table public.study_groups enable row level security;
create policy study_groups_read on public.study_groups for select to authenticated
  using ((select public.is_verified())
         and exists (select 1 from public.courses c join public.departments d on d.id = c.department_id
                     where c.id = course_id and d.university_id = (select public.my_university_id())));
revoke all on public.study_groups from anon, authenticated;
grant select on public.study_groups to authenticated;
grant all on public.study_groups to service_role;

create or replace function public.create_study_group(
  p_course uuid, p_title text, p_meets text default null, p_max int default 6
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_conv uuid;
begin
  if not exists (select 1 from public.enrollments
                 where user_id = auth.uid() and course_id = p_course and term = public.current_term()) then
    raise exception 'Join the course first' using errcode = '42501';
  end if;
  if (select count(*) from public.study_groups
      where creator_id = auth.uid() and created_at > now() - interval '1 day') >= 3 then
    raise exception 'That''s 3 study groups today.' using errcode = '54000';
  end if;
  insert into public.conversations (kind, university_id, title, course_id, created_by)
  values ('group', public.my_university_id(), left(trim(p_title), 60), p_course, auth.uid())
  returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id, role, accepted_at)
  values (v_conv, auth.uid(), 'owner', now());
  insert into public.study_groups (course_id, creator_id, title, meets, max_members, conversation_id)
  values (p_course, auth.uid(), trim(p_title), nullif(trim(p_meets), ''), p_max, v_conv);
  return v_conv;
end;
$$;

create or replace function public.join_study_group(p_group uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_group public.study_groups;
begin
  select * into v_group from public.study_groups where id = p_group for update;
  if not found then
    raise exception 'Study group not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.enrollments
                 where user_id = auth.uid() and course_id = v_group.course_id
                   and term = public.current_term()) then
    raise exception 'Join the course first' using errcode = '42501';
  end if;
  if (select count(*) from public.conversation_members where conversation_id = v_group.conversation_id)
     >= v_group.max_members then
    raise exception 'This study group is full' using errcode = '22023';
  end if;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_group.conversation_id, auth.uid(), now()) on conflict do nothing;
  return v_group.conversation_id;
end;
$$;

create or replace function public.course_study_groups(p_course uuid)
returns table (id uuid, title text, meets text, max_members int, member_count int,
               is_member boolean, conversation_id uuid)
language sql stable security definer set search_path = '' as $$
  select g.id, g.title, g.meets, g.max_members,
    (select count(*)::int from public.conversation_members m where m.conversation_id = g.conversation_id),
    public.is_member(g.conversation_id), g.conversation_id
  from public.study_groups g
  where g.course_id = p_course and public.is_verified()
  order by g.created_at desc;
$$;

-- ===========================================================================
-- Mentors: seniors opt in; juniors in the department ask; accepting connects them.
-- ===========================================================================
create table public.mentorships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mentor_id uuid not null references public.profiles on delete cascade,
  mentee_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'ended')),
  message text check (char_length(message) <= 300),
  responded_at timestamptz,
  check (mentor_id <> mentee_id)
);
create unique index mentorships_open_uq on public.mentorships (mentor_id, mentee_id)
  where status in ('pending', 'accepted');
alter table public.mentorships enable row level security;
create policy mentorships_own on public.mentorships for select to authenticated
  using (mentee_id = (select auth.uid()) or mentor_id = (select auth.uid()));
revoke all on public.mentorships from anon, authenticated;
grant select on public.mentorships to authenticated;
grant all on public.mentorships to service_role;

-- Opt in or out as a mentor (from semester 3 on). is_mentor is otherwise admin-only.
create or replace function public.set_mentor(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_on and not exists (select 1 from public.profiles
                          where id = auth.uid() and verification_status = 'verified'
                            and coalesce(semester, 0) >= 3) then
    raise exception 'Mentoring opens from your third semester' using errcode = '22023';
  end if;
  update public.profiles set is_mentor = p_on where id = auth.uid();
end;
$$;

-- Mentors in the caller's department who are ahead of them, as privacy allows.
create or replace function public.find_mentors(p_limit int default 30)
returns table (id uuid, handle text, full_name text, avatar_url text, batch_year int,
               semester int, bio text, requested boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select * from public.profiles where id = auth.uid())
  select pp.id, pp.handle::text, pp.full_name, pp.avatar_url, pp.batch_year, pp.semester, pp.bio,
    exists (select 1 from public.mentorships m
            where m.mentor_id = pp.id and m.mentee_id = auth.uid() and m.status in ('pending', 'accepted'))
  from public.profiles_public pp cross join me
  where pp.is_mentor and pp.id <> me.id and pp.department_id = me.department_id
    and (me.batch_year is null or pp.batch_year < me.batch_year)
  order by pp.batch_year desc, pp.full_name
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.request_mentor(p_mentor uuid, p_message text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.find_mentors(50) f where f.id = p_mentor) then
    raise exception 'This mentor isn''t available' using errcode = '42501';
  end if;
  if (select count(*) from public.mentorships
      where mentee_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 mentor requests today.' using errcode = '54000';
  end if;
  insert into public.mentorships (mentor_id, mentee_id, message)
  values (p_mentor, auth.uid(), nullif(trim(p_message), ''))
  on conflict do nothing;
  perform public.notify(p_mentor, 'mentor.request', auth.uid(), 'profile', auth.uid(),
                        jsonb_build_object('message', nullif(trim(p_message), '')));
end;
$$;

create or replace function public.respond_mentorship(p_mentee uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mentorships
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where mentor_id = auth.uid() and mentee_id = p_mentee and status = 'pending';
  if not found then
    raise exception 'No request to answer' using errcode = 'P0002';
  end if;
  if p_accept then
    -- Mentor and mentee become connections, so they can message.
    insert into public.connections (requester_id, addressee_id, status, responded_at)
    values (p_mentee, auth.uid(), 'accepted', now())
    on conflict ((least(requester_id, addressee_id)), (greatest(requester_id, addressee_id)))
    do update set status = 'accepted', responded_at = now();
    perform public.notify(p_mentee, 'mentor.accepted', auth.uid(), 'profile', auth.uid());
  end if;
end;
$$;

create or replace function public.mentor_requests()
returns table (mentee_id uuid, handle text, full_name text, avatar_url text, batch_year int,
               message text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name,
    case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end,
    p.batch_year, m.message, m.created_at
  from public.mentorships m
  join public.profiles p on p.id = m.mentee_id
  join public.privacy_settings s on s.user_id = p.id
  where m.mentor_id = auth.uid() and m.status = 'pending'
  order by m.created_at desc;
$$;

-- ===========================================================================
-- Backup fan-out gains its first tier: classmates in the same course (§4.7).
-- ===========================================================================
create or replace function public.backup_fanout(p_request uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
  v_me public.profiles;
  v_sent int := 0;
begin
  select * into v_req from public.backup_requests where id = p_request;
  select * into v_me from public.profiles where id = v_req.requester_id;

  with candidates as (
    select t.id,
      case
        when v_req.course_id is not null and exists (
          select 1 from public.enrollments e
          where e.user_id = t.id and e.course_id = v_req.course_id and e.term = public.current_term()
        ) then 0
        when v_me.section is not null and t.department_id = v_me.department_id
             and t.batch_year = v_me.batch_year and t.section = v_me.section then 1
        when t.department_id = v_me.department_id and t.batch_year = v_me.batch_year then 2
        when t.department_id = v_me.department_id and t.is_mentor then 3
      end as tier
    from public.profiles t
    where t.university_id = v_req.university_id and t.id <> v_req.requester_id
      and t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
      and t.onboarding_step >= 4
  ),
  picked as (
    select c.id from candidates c
    where c.tier is not null
      and public.wants(c.id, 'backup.nearby')
      and not public.blocked_between(c.id, v_req.requester_id)
      and (select count(*) from public.notifications n
           where n.user_id = c.id and n.type = 'backup.nearby'
             and n.created_at > now() - interval '1 day') < 5
    order by c.tier, random()
    limit 50
  ),
  sent as (
    insert into public.notifications (user_id, type, actor_id, entity_type, entity_id, payload)
    select p.id, 'backup.nearby', v_req.requester_id, 'backup', v_req.id,
      jsonb_build_object('title', v_req.title, 'category', v_req.category, 'urgency', v_req.urgency)
    from picked p
    returning 1
  )
  select count(*) into v_sent from sent;

  update public.backup_requests set notified_count = v_sent where id = p_request;
  return v_sent;
end;
$$;

-- create_backup takes an optional course from the caller's own courses this term.
create or replace function public.create_backup(
  p_title text, p_details text, p_category text, p_course uuid default null,
  p_urgency int default 2, p_hours int default 48
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  if p_course is not null and not exists (
    select 1 from public.enrollments
    where user_id = v_me.id and course_id = p_course and term = public.current_term()
  ) then
    raise exception 'Pick one of your courses' using errcode = '22023';
  end if;
  if (select count(*) from public.backup_requests
      where requester_id = v_me.id and status in ('open', 'claimed')) >= 3 then
    raise exception 'You have 3 open requests. Close one first.' using errcode = '54000';
  end if;
  if (select count(*) from public.backup_requests
      where requester_id = v_me.id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 requests today. Try again tomorrow.' using errcode = '54000';
  end if;
  if p_hours not between 1 and 72 then
    raise exception 'Pick how long it stays open (1–72 hours)' using errcode = '22023';
  end if;

  insert into public.backup_requests
    (university_id, requester_id, title, details, category, course_id, department_id,
     urgency, expires_at)
  values (v_me.university_id, v_me.id, trim(p_title), nullif(trim(p_details), ''), p_category,
          p_course, v_me.department_id, p_urgency, now() + make_interval(hours => p_hours))
  returning id into v_id;
  perform public.backup_fanout(v_id);
  return v_id;
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================
revoke execute on function public.add_course(uuid, text, text), public.join_course(uuid, text),
  public.leave_course(uuid), public.course_overview(uuid), public.course_people(uuid, int),
  public.my_courses(), public.join_course_chat(uuid),
  public.add_resource(uuid, text, text, text, text, int, int, text),
  public.vote_resource(uuid, boolean), public.delete_resource(uuid),
  public.busy_slots(uuid[]), public.set_on_campus(int), public.free_now(int),
  public.send_ping(uuid), public.create_study_group(uuid, text, text, int),
  public.join_study_group(uuid), public.course_study_groups(uuid),
  public.set_mentor(boolean), public.find_mentors(int), public.request_mentor(uuid, text),
  public.respond_mentorship(uuid, boolean), public.mentor_requests(), public.current_term()
from public, anon;
grant execute on function public.add_course(uuid, text, text), public.join_course(uuid, text),
  public.leave_course(uuid), public.course_overview(uuid), public.course_people(uuid, int),
  public.my_courses(), public.join_course_chat(uuid),
  public.add_resource(uuid, text, text, text, text, int, int, text),
  public.vote_resource(uuid, boolean), public.delete_resource(uuid),
  public.busy_slots(uuid[]), public.set_on_campus(int), public.free_now(int),
  public.send_ping(uuid), public.create_study_group(uuid, text, text, int),
  public.join_study_group(uuid), public.course_study_groups(uuid),
  public.set_mentor(boolean), public.find_mentors(int), public.request_mentor(uuid, text),
  public.respond_mentorship(uuid, boolean), public.mentor_requests(), public.current_term()
to authenticated;
