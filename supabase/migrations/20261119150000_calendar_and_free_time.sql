-- Phase 11.4: the academic calendar for students (reminders two days before a date), and
-- Free together / Free now counting official classes, not only the ones students typed in.

-- ===========================================================================
-- Whose class group is whose (for any student, not just the caller).
-- ===========================================================================
-- Any student's class group (internal; my_class_group() is the caller's): their own choice,
-- else the one their profile matches. Null when nothing (or two batches, no semester) matches.
create or replace function public.class_group_for(p_user uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me record;
  v_choice uuid;
  v_season text;
  v_ids uuid[];
begin
  if not exists (select 1 from public.profiles where id = p_user and verification_status = 'verified'
                 and banned_at is null and deleted_at is null) then
    return null;
  end if;
  select class_group_id into v_choice from public.timetable_settings where user_id = p_user;
  if v_choice is not null then
    return v_choice;
  end if;
  select program_id, batch_year, section, semester into v_me from public.profiles where id = p_user;
  if v_me.program_id is null or v_me.batch_year is null or v_me.section is null then
    return null;
  end if;
  v_season := public.intake_season(public.current_term(), v_me.semester);
  select array_agg(g.id order by
           exists (select 1 from public.timetable_entries e where e.class_group_id = g.id and e.live) desc,
           (g.intake_term is not distinct from v_season) desc)
    into v_ids
  from public.class_groups g
  where g.program_id = v_me.program_id and g.intake_year = v_me.batch_year
    and g.section = v_me.section
    and (v_season is null or g.intake_term is null or g.intake_term = v_season);
  if v_ids is null then
    return null;
  end if;
  -- Without a semester, a Fall and a Spring batch of the same year can't be told apart.
  if v_season is null and cardinality(v_ids) > 1 then
    return null;
  end if;
  return v_ids[1];
end;
$$;


create or replace function public.my_class_group() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when public.is_verified() then public.class_group_for(auth.uid()) end;
$$;

-- A student's busy times this week: their own classes, plus their section's official classes
-- and the ones they follow. Times only. Internal: busy_slots and free_now apply privacy.
create or replace function public.user_busy(p_user uuid)
returns table (day smallint, start_min smallint, end_min smallint)
language sql stable security definer set search_path = '' as $$
  select s.day, s.start_min, s.end_min from public.timetable_slots s
  where s.user_id = p_user and s.term = public.current_term()
  union
  select e.day, e.start_min, e.end_min from public.live_entries() e
  where e.class_group_id = public.class_group_for(p_user)
     or exists (select 1 from public.timetable_follows f
                where f.user_id = p_user
                  and (f.class_group_id is null or f.class_group_id = e.class_group_id)
                  and (f.course_id is null or f.course_id = e.course_id));
$$;

-- "Free together": the caller's busy times, and connections who share theirs.
create or replace function public.busy_slots(p_users uuid[])
returns table (user_id uuid, day smallint, start_min smallint, end_min smallint)
language sql stable security definer set search_path = '' as $$
  select u.uid, b.day, b.start_min, b.end_min
  from unnest(p_users) as u(uid)
  join public.privacy_settings p on p.user_id = u.uid
  cross join lateral public.user_busy(u.uid) b
  where u.uid = auth.uid()
     or (p.share_free_time and public.are_connected(auth.uid(), u.uid)
         and not public.blocked_between(auth.uid(), u.uid));
$$;

-- "Who's free now": on campus, opted in, and not in a class (their own or official).
create or replace function public.free_now(p_limit int default 30)
returns table (id uuid, handle text, full_name text, avatar_url text, department_id uuid,
               batch_year int, section text, free_until_min int)
language sql stable security definer set search_path = '' as $$
  with now_pk as (
    select (extract(isodow from now() at time zone 'Asia/Karachi')::int - 1) as day,
           (extract(hour from now() at time zone 'Asia/Karachi') * 60
            + extract(minute from now() at time zone 'Asia/Karachi'))::int as minute
  ),
  me as (select * from public.profiles where id = auth.uid()),
  here as (
    select pr.user_id from public.presence pr
    join public.privacy_settings ps on ps.user_id = pr.user_id and ps.show_free_now
    where pr.on_campus_until > now() and pr.user_id <> auth.uid() and public.is_verified()
  ),
  busy as (
    select h.user_id, b.* from here h cross join lateral public.user_busy(h.user_id) b
    cross join now_pk n where b.day = n.day
  )
  select pp.id, pp.handle::text, pp.full_name, pp.avatar_url, pp.department_id,
    pp.batch_year, pp.section,
    (select min(b.start_min)::int from busy b, now_pk n
      where b.user_id = pp.id and b.start_min > n.minute)
  from here h
  join public.profiles_public pp on pp.id = h.user_id
  cross join now_pk n
  cross join me
  where not exists (select 1 from busy b
                    where b.user_id = h.user_id and n.minute >= b.start_min and n.minute < b.end_min)
  order by (pp.department_id = me.department_id and pp.batch_year = me.batch_year) desc,
           (pp.department_id = me.department_id) desc, pp.full_name
  limit least(greatest(p_limit, 1), 50);
$$;

-- ===========================================================================
-- Calendar reminders: two days before, at 09:00 Pakistan time.
-- ===========================================================================
create table public.calendar_reminders (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  event_id uuid not null references public.calendar_events on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (user_id, event_id)
);
alter table public.calendar_reminders enable row level security;
create policy calendar_reminders_read on public.calendar_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy calendar_reminders_add on public.calendar_reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_verified())
              and exists (select 1 from public.calendar_events e
                          where e.id = event_id and e.status = 'published'));
create policy calendar_reminders_remove on public.calendar_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.calendar_reminders from anon, authenticated;
grant select, insert, delete on public.calendar_reminders to authenticated;
grant all on public.calendar_reminders to service_role;

-- "Remind me of every deadline" this term and after: registration, add/drop, withdraw,
-- exams, results and other deadlines (not holidays).
create or replace function public.remind_all_deadlines() returns int
language plpgsql security definer set search_path = '' as $$
declare v_added int;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  insert into public.calendar_reminders (user_id, event_id)
  select auth.uid(), e.id from public.calendar_events e
  where e.university_id = public.my_university_id() and e.status = 'published'
    and e.starts_on > (now() at time zone 'Asia/Karachi')::date
    and e.kind in ('registration', 'add_drop', 'withdraw', 'midterm', 'final', 'result', 'deadline')
  on conflict do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end;
$$;

-- Daily: reminders for dates in the next two days that haven't been sent.
create or replace function public.calendar_reminders_due() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_sent int := 0;
  r record;
begin
  for r in
    update public.calendar_reminders cr set sent_at = now()
    from public.calendar_events e
    where e.id = cr.event_id and cr.sent_at is null and e.status = 'published'
      and e.starts_on > v_today and e.starts_on <= v_today + 2
    returning cr.user_id, e.id, e.title, e.kind, e.starts_on, e.ends_on, e.tentative
  loop
    perform public.notify(r.user_id, 'calendar.reminder', null, 'calendar_event', r.id,
      jsonb_build_object('title', r.title, 'kind', r.kind, 'starts_on', r.starts_on,
                         'ends_on', r.ends_on, 'tentative', r.tentative));
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
select cron.schedule('calendar-reminders', '0 4 * * *', 'select public.calendar_reminders_due()');

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'backup.expired',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted', 'mentor.ended',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test',
  'studies.approved', 'studies.rejected',
  'timetable.changed', 'timetable.published', 'calendar.reminder'
));

-- Calendar reminders share the "Timetable and calendar" switch.
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
      when 'timetable' then p.timetable
      when 'calendar' then p.timetable
      else true end
    from public.notification_prefs p where p.user_id = p_user
  ), true);
$$;

revoke execute on function public.class_group_for(uuid), public.user_busy(uuid),
  public.calendar_reminders_due()
  from public, anon, authenticated;
grant execute on function public.class_group_for(uuid), public.user_busy(uuid),
  public.calendar_reminders_due() to service_role;
revoke execute on function public.remind_all_deadlines() from public, anon;
grant execute on function public.remind_all_deadlines() to authenticated, service_role;
