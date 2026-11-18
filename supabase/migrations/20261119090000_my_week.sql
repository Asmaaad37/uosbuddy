-- Phase 11.2: My week. A student's official classes come from the class group that matches
-- their profile (program, the year they joined, section) and, because UoS admits in Fall and
-- Spring, the intake season implied by their semester. They can set the group themselves when
-- the match is wrong, and follow another section's classes (repeat courses, electives).

-- A follow is a whole group, a course in one group, or a course in any group.
alter table public.timetable_follows drop constraint timetable_follows_check;
alter table public.timetable_follows
  add constraint timetable_follows_target check (class_group_id is not null or course_id is not null);

-- "My section is different": the student's own choice of class group.
create table public.timetable_settings (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  class_group_id uuid references public.class_groups on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.timetable_settings enable row level security;
create policy timetable_settings_own on public.timetable_settings for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.timetable_settings from anon, authenticated;
grant select on public.timetable_settings to authenticated;
grant all on public.timetable_settings to service_role;

-- In a Fall term, odd semesters joined in Fall and even ones in Spring; the other way round in
-- a Spring term. Summer has no rule.
create or replace function public.intake_season(p_term text, p_semester int) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_semester is null then null
    when split_part(p_term, '-', 2) = 'fall' then case when p_semester % 2 = 1 then 'fall' else 'spring' end
    when split_part(p_term, '-', 2) = 'spring' then case when p_semester % 2 = 1 then 'spring' else 'fall' end
  end;
$$;

-- This week's Monday in Pakistan time.
create or replace function public.this_week() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', (now() at time zone 'Asia/Karachi'))::date;
$$;

-- The class group for the signed-in student: their own choice, else the one their profile
-- matches. Null when nothing (or more than one group, with no semester to tell) matches.
create or replace function public.my_class_group() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me record;
  v_choice uuid;
  v_season text;
  v_ids uuid[];
begin
  if not public.is_verified() then
    return null;
  end if;
  select class_group_id into v_choice from public.timetable_settings where user_id = auth.uid();
  if v_choice is not null then
    return v_choice;
  end if;
  select program_id, batch_year, section, semester into v_me from public.profiles where id = auth.uid();
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

-- Everything the My week screen needs in one call:
-- {group: {id, label} | null, matched: "choice" | "profile" | null, term, week_of,
--  published_at, classes: [{id, course_title, course_code, room_label, room_id, teacher_name,
--  day, start_min, end_min, practical, group_label, follow_id}]}.
-- A week's amendment, when there is one for this week, replaces that department's term rows.
create or replace function public.my_timetable() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_term text := public.current_term();
  v_week date := public.this_week();
  v_group uuid;
  v_choice boolean;
  v_label text;
  v_dept uuid;
  v_published timestamptz;
  v_classes jsonb;
begin
  if not public.is_verified() then
    return jsonb_build_object('group', null, 'matched', null, 'term', v_term, 'classes', '[]'::jsonb);
  end if;
  v_choice := exists (select 1 from public.timetable_settings
                      where user_id = auth.uid() and class_group_id is not null);
  v_group := public.my_class_group();
  select g.label, g.department_id into v_label, v_dept from public.class_groups g where g.id = v_group;
  select max(i.published_at) into v_published from public.timetable_imports i
  where i.department_id = v_dept and i.term = v_term and i.status = 'published';

  with live as (
    select e.* from public.timetable_entries e
    join public.departments d on d.id = e.department_id
    where e.live and e.term = v_term and d.university_id = public.my_university_id()
      and (e.week_of = v_week
           or (e.week_of is null and not exists (
                 select 1 from public.timetable_entries a
                 where a.live and a.department_id = e.department_id and a.term = e.term
                   and a.week_of = v_week)))
  ), mine as (
    select l.*, null::uuid as follow_id from live l where l.class_group_id = v_group
  ), followed as (
    select l.*, f.id as follow_id from live l
    join public.timetable_follows f on f.user_id = auth.uid()
      and (f.class_group_id is null or f.class_group_id = l.class_group_id)
      and (f.course_id is null or f.course_id = l.course_id)
    where v_group is null or l.class_group_id <> v_group
  ), merged as (
    select distinct on (day, start_min, course_key, room_label) *
    from (select * from mine union all select * from followed) x
    order by day, start_min, course_key, room_label, follow_id nulls first
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'course_title', m.course_title, 'course_code', m.course_code,
      'room_label', m.room_label, 'room_id', m.room_id, 'teacher_name', m.teacher_name,
      'day', m.day, 'start_min', m.start_min, 'end_min', m.end_min, 'practical', m.practical,
      'group_label', case when m.follow_id is not null then g.label end,
      'follow_id', m.follow_id)
      order by m.day, m.start_min), '[]'::jsonb)
    into v_classes
  from merged m join public.class_groups g on g.id = m.class_group_id;

  return jsonb_build_object(
    'group', case when v_group is null then null
                  else jsonb_build_object('id', v_group, 'label', v_label) end,
    'matched', case when v_group is null then null when v_choice then 'choice' else 'profile' end,
    'term', v_term, 'week_of', v_week, 'published_at', v_published, 'classes', v_classes);
end;
$$;

-- Class groups with a published timetable this term, for "Change my section" and following.
create or replace function public.timetable_groups()
returns table (id uuid, label text, department_id uuid, program_id uuid, intake_year smallint,
               intake_term text, section text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.label, g.department_id, g.program_id, g.intake_year, g.intake_term, g.section
  from public.class_groups g
  join public.departments d on d.id = g.department_id
  where public.is_verified() and d.university_id = public.my_university_id()
    and exists (select 1 from public.timetable_entries e
                where e.class_group_id = g.id and e.live and e.term = public.current_term())
  order by g.label;
$$;

-- The student's own choice of class group; null goes back to matching the profile.
create or replace function public.set_my_class_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_group is not null and not exists (
    select 1 from public.class_groups g join public.departments d on d.id = g.department_id
    where g.id = p_group and d.university_id = public.my_university_id()) then
    raise exception 'Choose a section from the list' using errcode = '22023';
  end if;
  insert into public.timetable_settings (user_id, class_group_id, updated_at)
  values (auth.uid(), p_group, now())
  on conflict (user_id) do update set class_group_id = excluded.class_group_id, updated_at = now();
end;
$$;

revoke execute on function public.intake_season(text, int), public.this_week(),
  public.my_class_group(), public.my_timetable(), public.timetable_groups(),
  public.set_my_class_group(uuid)
  from public, anon;
grant execute on function public.intake_season(text, int), public.this_week(),
  public.my_class_group(), public.my_timetable(), public.timetable_groups(),
  public.set_my_class_group(uuid)
  to authenticated, service_role;
