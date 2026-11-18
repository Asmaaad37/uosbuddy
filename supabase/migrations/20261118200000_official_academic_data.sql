-- Phase 11.1: official academic data (docs/plans/academic-features.md §4).
-- Department timetables are imported by data editors, reviewed as a diff against what's live,
-- then published; students only ever read published rows. The academic calendar is data, not
-- HTML. Every write goes through an audited function; nothing here is writable directly except
-- a student's own follows.

-- ===========================================================================
-- Terms (the existing "2026-fall" codes stay the key).
-- ===========================================================================
create table public.academic_terms (
  code text primary key check (code ~ '^[0-9]{4}-(fall|spring|summer)$'),
  university_id uuid not null references public.universities on delete cascade,
  name text not null check (char_length(name) between 3 and 40),
  starts_on date,
  ends_on date,
  check (ends_on is null or starts_on is null or starts_on <= ends_on)
);

-- ===========================================================================
-- Places and people. Rooms are seeded from the timetable's own room labels.
-- ===========================================================================
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{2,8}$'),
  name text check (char_length(name) <= 80),
  campus_id uuid references public.campuses on delete set null,
  unique (university_id, code)
);

create type public.room_kind as enum ('lecture', 'lab', 'hall', 'online', 'office', 'other');
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  building_id uuid references public.buildings on delete set null,
  code text not null check (char_length(code) between 1 and 40),
  name text check (char_length(name) <= 80),
  floor smallint,
  capacity smallint check (capacity > 0),
  kind public.room_kind not null default 'lecture',
  department_id uuid references public.departments on delete set null,
  aliases text[] not null default '{}',
  unique nulls not distinct (university_id, building_id, code)
);

-- Teachers' names are public on official timetables; profiles link to su.edu.pk only.
create or replace function public.norm_person(p_name text) returns text
language sql immutable set search_path = '' as $$
  select nullif(trim(regexp_replace(regexp_replace(lower(coalesce(p_name, '')),
    '^\s*((dr|mr|mrs|ms|miss|prof|engr|sir|madam)\.?\s+)+', ''), '\s+', ' ', 'g')), '');
$$;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  department_id uuid references public.departments on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  name_norm text generated always as (public.norm_person(name)) stored,
  title text check (char_length(title) <= 60),
  profile_url text check (profile_url ~ '^https://su\.edu\.pk/'),
  aliases text[] not null default '{}'
);
create index teachers_dept_name_idx on public.teachers (department_id, name_norm);

-- Who a class is for: matches a profile's department, program, intake year and section.
create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments on delete cascade,
  program_id uuid not null references public.programs on delete cascade,
  intake_year smallint not null check (intake_year between 1990 and 2100),
  section text not null check (section in ('REG', 'SS1', 'SS2')),
  label text not null check (char_length(label) between 3 and 120),
  unique (department_id, program_id, intake_year, section)
);

-- ===========================================================================
-- Department data editors (granted by admins).
-- ===========================================================================
create table public.data_editors (
  user_id uuid not null references public.profiles on delete cascade,
  department_id uuid not null references public.departments on delete cascade,
  scopes text[] not null default '{timetable,calendar}'
    check (scopes <@ array['timetable', 'calendar'] and cardinality(scopes) > 0),
  granted_by uuid references public.profiles on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, department_id)
);

create or replace function public.is_data_editor(p_department uuid, p_scope text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.data_editors d
    join public.profiles p on p.id = d.user_id
    where d.user_id = auth.uid() and d.department_id = p_department and p_scope = any(d.scopes)
      and p.banned_at is null and p.deleted_at is null);
$$;

-- The calendar is university-wide: admins, or anyone with the calendar scope in that university.
create or replace function public.can_edit_calendar(p_university uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.data_editors d
    join public.departments dep on dep.id = d.department_id
    join public.profiles p on p.id = d.user_id
    where d.user_id = auth.uid() and dep.university_id = p_university and 'calendar' = any(d.scopes)
      and p.banned_at is null and p.deleted_at is null);
$$;

create or replace function public.grant_data_editor(p_user uuid, p_department uuid,
  p_scopes text[] default '{timetable,calendar}') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can add data editors' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and verification_status = 'verified'
                 and banned_at is null and deleted_at is null) then
    raise exception 'Data editors must be verified' using errcode = '22023';
  end if;
  insert into public.data_editors (user_id, department_id, scopes, granted_by)
  values (p_user, p_department, p_scopes, auth.uid())
  on conflict (user_id, department_id)
    do update set scopes = excluded.scopes, granted_by = excluded.granted_by, granted_at = now();
  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (auth.uid(), 'data_editor.grant', 'profile', p_user,
          jsonb_build_object('department_id', p_department, 'scopes', p_scopes));
end;
$$;

create or replace function public.revoke_data_editor(p_user uuid, p_department uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove data editors' using errcode = '42501';
  end if;
  delete from public.data_editors where user_id = p_user and department_id = p_department;
  insert into public.audit_log (actor_id, action, target_type, target_id, before)
  values (auth.uid(), 'data_editor.revoke', 'profile', p_user,
          jsonb_build_object('department_id', p_department));
end;
$$;

-- ===========================================================================
-- Imports and their rows. Nothing is visible to students until published.
-- ===========================================================================
create type public.import_status as enum ('review', 'published', 'discarded');
create table public.timetable_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  department_id uuid not null references public.departments on delete cascade,
  term text not null references public.academic_terms,
  week_of date check (week_of is null or extract(isodow from week_of) = 1),  -- null = the term timetable
  source_kind text not null check (source_kind in ('pdf', 'json', 'csv', 'xlsx', 'manual', 'revert')),
  source_name text check (char_length(source_name) <= 200),
  parser_version text not null check (char_length(parser_version) <= 40),
  status public.import_status not null default 'review',
  report jsonb,                               -- pages, rooms, sessions, warnings
  diff_summary jsonb,                         -- {added, removed, moved, retimed, teacher}
  created_by uuid references public.profiles on delete set null,
  published_by uuid references public.profiles on delete set null,
  published_at timestamptz
);
create index timetable_imports_dept_idx on public.timetable_imports (department_id, term, status, published_at desc);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.timetable_imports on delete cascade,
  department_id uuid not null references public.departments on delete cascade,
  term text not null references public.academic_terms,
  week_of date,
  class_group_id uuid not null references public.class_groups on delete cascade,
  course_id uuid references public.courses on delete set null,
  course_code text check (char_length(course_code) <= 20),
  course_title text not null check (char_length(course_title) between 1 and 160),
  course_key text not null generated always as (coalesce(
    nullif(upper(regexp_replace(coalesce(course_code, ''), '[^A-Za-z0-9]', '', 'g')), ''),
    lower(course_title))) stored,
  teacher_id uuid references public.teachers on delete set null,
  teacher_name text check (char_length(teacher_name) <= 80),
  room_id uuid references public.rooms on delete set null,
  room_label text not null check (char_length(room_label) between 1 and 120),
  day smallint not null check (day between 0 and 6),            -- 0 = Monday (as timetable_slots)
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  practical boolean not null default false,
  combined_key text check (char_length(combined_key) <= 80),    -- shared by the groups of one combined class
  excluded boolean not null default false,                      -- left out by the editor during review
  live boolean not null default false,                          -- part of the published timetable now
  raw jsonb,
  check (start_min < end_min)
);
create index timetable_entries_import_idx on public.timetable_entries (import_id);
create index timetable_entries_live_group_idx on public.timetable_entries (class_group_id, day, start_min) where live;
create index timetable_entries_live_room_idx on public.timetable_entries (room_id, day, start_min) where live;

-- What students see: the rows of the latest published import per department, term and week.
create view public.timetable_live with (security_invoker = true) as
  select e.id, e.import_id, e.department_id, e.class_group_id, e.course_id, e.course_code,
         e.course_title, e.teacher_id, e.teacher_name, e.room_id, e.room_label, e.day,
         e.start_min, e.end_min, e.practical, e.combined_key, e.term, e.week_of
  from public.timetable_entries e
  where e.live;

-- Change history: drives alerts and "what changed".
create table public.timetable_changes (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.timetable_imports on delete cascade,
  department_id uuid not null references public.departments on delete cascade,
  class_group_id uuid references public.class_groups on delete cascade,
  kind text not null check (kind in ('added', 'removed', 'moved', 'retimed', 'teacher')),
  before jsonb,
  after jsonb
);
create index timetable_changes_import_idx on public.timetable_changes (import_id);
create index timetable_changes_group_idx on public.timetable_changes (class_group_id, id desc);

-- Other groups or courses a student follows (repeat courses, electives).
create table public.timetable_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  class_group_id uuid references public.class_groups on delete cascade,
  course_id uuid references public.courses on delete cascade,
  created_at timestamptz not null default now(),
  check ((class_group_id is null) <> (course_id is null)),
  unique nulls not distinct (user_id, class_group_id, course_id)
);

-- ===========================================================================
-- Academic calendar.
-- ===========================================================================
create type public.calendar_kind as enum
  ('term', 'registration', 'add_drop', 'withdraw', 'midterm', 'final', 'result', 'holiday',
   'break', 'deadline', 'other');
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities on delete cascade,
  term text references public.academic_terms,
  kind public.calendar_kind not null,
  title text not null check (char_length(title) between 3 and 140),
  notes text check (char_length(notes) <= 400),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  tentative boolean not null default false,   -- subject to the moon or a government notification
  source text check (char_length(source) <= 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles on delete set null,
  updated_at timestamptz not null default now()
);
create index calendar_events_uni_idx on public.calendar_events (university_id, starts_on);

-- ===========================================================================
-- RLS: verified students of the university read reference and published data.
-- ===========================================================================
alter table public.academic_terms enable row level security;
alter table public.buildings enable row level security;
alter table public.rooms enable row level security;
alter table public.teachers enable row level security;
alter table public.class_groups enable row level security;
alter table public.data_editors enable row level security;
alter table public.timetable_imports enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.timetable_changes enable row level security;
alter table public.timetable_follows enable row level security;
alter table public.calendar_events enable row level security;

create policy terms_read on public.academic_terms for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id()));
create policy buildings_read on public.buildings for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id()));
create policy rooms_read on public.rooms for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id()));
create policy teachers_read on public.teachers for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id()));
create policy class_groups_read on public.class_groups for select to authenticated
  using ((select public.is_verified()) and exists (
    select 1 from public.departments d
    where d.id = department_id and d.university_id = (select public.my_university_id())));

create policy data_editors_read on public.data_editors for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy imports_read on public.timetable_imports for select to authenticated
  using (public.is_data_editor(department_id, 'timetable'));

create policy entries_read on public.timetable_entries for select to authenticated
  using ((live and (select public.is_verified()) and exists (
           select 1 from public.departments d
           where d.id = department_id and d.university_id = (select public.my_university_id())))
         or public.is_data_editor(department_id, 'timetable'));

create policy changes_read on public.timetable_changes for select to authenticated
  using (((select public.is_verified()) and exists (
           select 1 from public.departments d
           where d.id = department_id and d.university_id = (select public.my_university_id())))
         or public.is_data_editor(department_id, 'timetable'));

create policy follows_own on public.timetable_follows for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_verified()));

create policy calendar_read on public.calendar_events for select to authenticated
  using ((status = 'published' and (select public.is_verified())
          and university_id = (select public.my_university_id()))
         or public.can_edit_calendar(university_id));

revoke all on public.academic_terms, public.buildings, public.rooms, public.teachers,
  public.class_groups, public.data_editors, public.timetable_imports, public.timetable_entries,
  public.timetable_changes, public.timetable_follows, public.calendar_events, public.timetable_live
  from anon, authenticated;
grant select on public.academic_terms, public.buildings, public.rooms, public.teachers,
  public.class_groups, public.data_editors, public.timetable_imports, public.timetable_entries,
  public.timetable_changes, public.calendar_events, public.timetable_live
  to authenticated;
grant select, insert, delete on public.timetable_follows to authenticated;
grant all on public.academic_terms, public.buildings, public.rooms, public.teachers,
  public.class_groups, public.data_editors, public.timetable_imports, public.timetable_entries,
  public.timetable_changes, public.timetable_follows, public.calendar_events, public.timetable_live
  to service_role;

-- ===========================================================================
-- Import lifecycle: stage → (exclude rows) → diff → publish | discard; revert.
-- ===========================================================================

-- Stages a parsed timetable for review. Rows are JSON objects with program_id, intake_year,
-- section (REG|SS1|SS2), course_code, course_title, teacher_name, building_code, room_code,
-- room_label, day, start_min, end_min, practical, combined_key and raw. Unknown buildings,
-- rooms, teachers, courses and class groups are created from the labels (the timetable is the
-- room list); the editor sees them in the diff before anything is published.
create or replace function public.stage_import(
  p_department uuid, p_term text, p_week_of date, p_source_kind text, p_source_name text,
  p_parser_version text, p_report jsonb, p_rows jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uni uuid;
  v_import uuid;
  r jsonb;
  v_n int := 0;
  v_program record;
  v_group uuid;
  v_building uuid;
  v_bcode text;
  v_rcode text;
  v_room uuid;
  v_teacher uuid;
  v_tname text;
  v_tnorm text;
  v_course uuid;
  v_ccode text;
  v_section text;
  v_intake int;
begin
  if not public.is_data_editor(p_department, 'timetable') then
    raise exception 'You can''t import timetables for this department' using errcode = '42501';
  end if;
  select university_id into v_uni from public.departments where id = p_department;
  if not exists (select 1 from public.academic_terms where code = p_term and university_id = v_uni) then
    raise exception 'Choose a term' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'The file has no classes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'That''s more than 5,000 classes; import one department at a time' using errcode = '54000';
  end if;

  insert into public.timetable_imports (department_id, term, week_of, source_kind, source_name,
    parser_version, report, created_by)
  values (p_department, p_term, p_week_of, p_source_kind, left(p_source_name, 200),
    p_parser_version, p_report, auth.uid())
  returning id into v_import;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_n := v_n + 1;
    -- Class group.
    select pr.id, pr.name into v_program from public.programs pr
    where pr.id = (r->>'program_id')::uuid and pr.department_id = p_department;
    if v_program.id is null then
      raise exception 'Row %: choose a program from this department', v_n using errcode = '22023';
    end if;
    v_section := r->>'section';
    v_intake := (r->>'intake_year')::int;
    if v_intake is null then
      raise exception 'Row %: add the intake year (from the session, like 2024-2028)', v_n using errcode = '22023';
    end if;
    if v_section is null or v_section not in ('REG', 'SS1', 'SS2') then
      raise exception 'Row %: section must be REG, SS1 or SS2', v_n using errcode = '22023';
    end if;
    insert into public.class_groups (department_id, program_id, intake_year, section, label)
    values (p_department, v_program.id, v_intake, v_section,
            v_program.name || ' · ' || v_intake || ' · ' ||
            case v_section when 'REG' then 'Regular' when 'SS1' then 'Self Support 1' else 'Self Support 2' end)
    on conflict (department_id, program_id, intake_year, section) do update set label = public.class_groups.label
    returning id into v_group;

    -- Room (and building).
    v_building := null;
    v_bcode := nullif(upper(trim(coalesce(r->>'building_code', ''))), '');
    if v_bcode is not null then
      insert into public.buildings (university_id, code) values (v_uni, v_bcode)
      on conflict (university_id, code) do update set code = excluded.code
      returning id into v_building;
    end if;
    v_rcode := nullif(trim(coalesce(r->>'room_code', '')), '');
    if v_rcode is null then
      v_rcode := left(trim(r->>'room_label'), 40);
    end if;
    select id into v_room from public.rooms
    where university_id = v_uni and building_id is not distinct from v_building
      and (code = v_rcode or v_rcode = any(aliases))
    limit 1;
    if v_room is null then
      insert into public.rooms (university_id, building_id, code, name, department_id,
                                kind)
      values (v_uni, v_building, v_rcode, left(trim(r->>'room_label'), 80), p_department,
              case when coalesce((r->>'practical')::boolean, false) then 'lab'::public.room_kind
                   else 'lecture'::public.room_kind end)
      on conflict (university_id, building_id, code) do update set code = excluded.code
      returning id into v_room;
    end if;

    -- Teacher: exact or alias match, then a unique prefix for truncated names ("…").
    v_teacher := null;
    v_tname := nullif(trim(coalesce(r->>'teacher_name', '')), '');
    if v_tname is not null then
      v_tnorm := public.norm_person(regexp_replace(v_tname, '(…|\.\.\.)$', ''));
      select id into v_teacher from public.teachers
      where university_id = v_uni and (name_norm = v_tnorm or v_tname = any(aliases))
      order by (department_id = p_department) desc nulls last
      limit 1;
      if v_teacher is null and v_tname ~ '(…|\.\.\.)$' then
        select min(id::text)::uuid into v_teacher from public.teachers
        where university_id = v_uni and department_id = p_department
          and starts_with(name_norm, v_tnorm)
        having count(*) = 1;
      end if;
      if v_teacher is null and v_tname !~ '(…|\.\.\.)$' then
        insert into public.teachers (university_id, department_id, name)
        values (v_uni, p_department, left(v_tname, 80))
        returning id into v_teacher;
      end if;
    end if;

    -- Course: match by normalised code; create it when the timetable names a new one.
    v_course := null;
    v_ccode := nullif(upper(regexp_replace(coalesce(r->>'course_code', ''), '[^A-Za-z0-9]', '', 'g')), '');
    if v_ccode is not null then
      select id into v_course from public.courses
      where department_id = p_department and code_norm = v_ccode;
      if v_course is null and v_ccode ~ '^[A-Z]{2,8}[0-9]{2,5}[A-Z]?$'
         and coalesce(r->>'course_title', '') !~ '(…|\.\.\.)$' then
        insert into public.courses (department_id, code, title, created_by)
        values (p_department, regexp_replace(v_ccode, '^([A-Z]+)([0-9].*)$', '\1-\2'),
                left(trim(r->>'course_title'), 120), auth.uid())
        on conflict (department_id, code_norm) do nothing
        returning id into v_course;
      end if;
    end if;

    insert into public.timetable_entries (import_id, department_id, term, week_of, class_group_id,
      course_id, course_code, course_title, teacher_id, teacher_name, room_id, room_label, day,
      start_min, end_min, practical, combined_key, raw)
    values (v_import, p_department, p_term, p_week_of, v_group, v_course,
      nullif(trim(coalesce(r->>'course_code', '')), ''),
      coalesce((select c.title from public.courses c
                where c.id = v_course and coalesce(r->>'course_title', '') ~ '(…|\.\.\.)$'),
               trim(r->>'course_title')),
      v_teacher, v_tname, v_room, trim(r->>'room_label'),
      (r->>'day')::smallint, (r->>'start_min')::smallint, (r->>'end_min')::smallint,
      coalesce((r->>'practical')::boolean, false), nullif(r->>'combined_key', ''), r->'raw');
  end loop;

  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (auth.uid(), 'timetable.stage', 'timetable_import', v_import,
          jsonb_build_object('department_id', p_department, 'term', p_term, 'week_of', p_week_of,
                             'rows', v_n, 'source', p_source_kind));
  return v_import;
end;
$$;

-- The changes an import would make against what's live for the same department, term and week.
-- Rows are paired on group + course + day + start; a different room is "moved", a different
-- end time "retimed", a different teacher "teacher". Leftovers with the same group and course
-- pair up as "retimed" (new day or time); the rest are "added" or "removed".
create or replace function public.import_diff(p_import uuid)
returns table (kind text, class_group_id uuid, before jsonb, after jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_imp public.timetable_imports;
begin
  select * into v_imp from public.timetable_imports where id = p_import;
  if v_imp.id is null or not public.is_data_editor(v_imp.department_id, 'timetable') then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  return query
  with old_rows as (
    select e.*, row_number() over (partition by e.class_group_id, e.course_key, e.day, e.start_min
                                   order by e.room_label, e.end_min) as rn
    from public.timetable_entries e
    where e.live and e.department_id = v_imp.department_id and e.term = v_imp.term
      and e.week_of is not distinct from v_imp.week_of and e.import_id <> v_imp.id
  ), new_rows as (
    select e.*, row_number() over (partition by e.class_group_id, e.course_key, e.day, e.start_min
                                   order by e.room_label, e.end_min) as rn
    from public.timetable_entries e
    where e.import_id = v_imp.id and not e.excluded
  ), same as (
    select o.id as oid, n.id as nid from old_rows o
    join new_rows n on n.class_group_id = o.class_group_id and n.course_key = o.course_key
      and n.day = o.day and n.start_min = o.start_min and n.rn = o.rn
  ), old_left as (
    select o.*, row_number() over (partition by o.class_group_id, o.course_key order by o.day, o.start_min) as rk
    from old_rows o where o.id not in (select oid from same)
  ), new_left as (
    select n.*, row_number() over (partition by n.class_group_id, n.course_key order by n.day, n.start_min) as rk
    from new_rows n where n.id not in (select nid from same)
  ), pairs as (
    select s.oid, s.nid, false as shifted from same s
    union all
    select o.id, n.id, true from old_left o
    join new_left n on n.class_group_id = o.class_group_id and n.course_key = o.course_key and n.rk = o.rk
  ), snap as (
    select e.id, jsonb_build_object('course_title', e.course_title, 'course_code', e.course_code,
      'room_label', e.room_label, 'teacher_name', e.teacher_name, 'day', e.day,
      'start_min', e.start_min, 'end_min', e.end_min) as j, e.class_group_id, e.room_label,
      e.end_min, e.teacher_name
    from public.timetable_entries e
    where e.id in (select oid from pairs union select nid from pairs
                   union select id from old_rows union select id from new_rows)
  )
  select case when p.shifted then 'retimed'
              when so.room_label <> sn.room_label then 'moved'
              when so.end_min <> sn.end_min then 'retimed'
              else 'teacher' end,
         sn.class_group_id, so.j, sn.j
  from pairs p join snap so on so.id = p.oid join snap sn on sn.id = p.nid
  where p.shifted or so.room_label <> sn.room_label or so.end_min <> sn.end_min
     or so.teacher_name is distinct from sn.teacher_name
  union all
  select 'removed', s.class_group_id, s.j, null::jsonb from old_rows o join snap s on s.id = o.id
  where o.id not in (select oid from pairs)
  union all
  select 'added', s.class_group_id, null::jsonb, s.j from new_rows n join snap s on s.id = n.id
  where n.id not in (select nid from pairs);
end;
$$;

create or replace function public.exclude_entry(p_entry uuid, p_excluded boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_dept uuid;
begin
  select i.department_id into v_dept from public.timetable_entries e
  join public.timetable_imports i on i.id = e.import_id
  where e.id = p_entry and i.status = 'review';
  if v_dept is null or not public.is_data_editor(v_dept, 'timetable') then
    raise exception 'That class can''t be changed' using errcode = '42501';
  end if;
  update public.timetable_entries set excluded = p_excluded where id = p_entry;
end;
$$;

create or replace function public.publish_import(p_import uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.timetable_imports;
  v_summary jsonb;
begin
  select * into v_imp from public.timetable_imports where id = p_import for update;
  if v_imp.id is null or not public.is_data_editor(v_imp.department_id, 'timetable') then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_imp.status <> 'review' then
    raise exception 'This import is already %', v_imp.status using errcode = '22023';
  end if;
  if not exists (select 1 from public.timetable_entries where import_id = p_import and not excluded) then
    raise exception 'Nothing to publish: every class is excluded' using errcode = '22023';
  end if;
  -- One publish at a time per department and term.
  perform pg_advisory_xact_lock(hashtextextended(v_imp.department_id::text || v_imp.term, 0));

  insert into public.timetable_changes (import_id, department_id, class_group_id, kind, before, after)
  select p_import, v_imp.department_id, d.class_group_id, d.kind, d.before, d.after
  from public.import_diff(p_import) d;

  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into v_summary
  from (select kind as k, count(*) as n from public.timetable_changes
        where import_id = p_import group by kind) s;

  update public.timetable_entries set live = false
  where live and import_id <> p_import and department_id = v_imp.department_id
    and term = v_imp.term and week_of is not distinct from v_imp.week_of;
  update public.timetable_entries set live = not excluded where import_id = p_import;
  update public.timetable_imports
     set status = 'published', published_by = auth.uid(), published_at = clock_timestamp(),
         diff_summary = v_summary
   where id = p_import;

  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (auth.uid(), 'timetable.publish', 'timetable_import', p_import, v_summary);
  return v_summary;
end;
$$;

create or replace function public.discard_import(p_import uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_imp public.timetable_imports;
begin
  select * into v_imp from public.timetable_imports where id = p_import for update;
  if v_imp.id is null or not public.is_data_editor(v_imp.department_id, 'timetable') then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_imp.status <> 'review' then
    raise exception 'Only an import in review can be discarded' using errcode = '22023';
  end if;
  delete from public.timetable_entries where import_id = p_import;
  update public.timetable_imports set status = 'discarded' where id = p_import;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'timetable.discard', 'timetable_import', p_import);
end;
$$;

-- "Revert to this one": copies an earlier published import and publishes the copy, so the
-- change history and alerts stay honest.
create or replace function public.revert_import(p_import uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.timetable_imports;
  v_new uuid;
begin
  select * into v_imp from public.timetable_imports where id = p_import;
  if v_imp.id is null or not public.is_data_editor(v_imp.department_id, 'timetable') then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_imp.status <> 'published' then
    raise exception 'Only a published import can be restored' using errcode = '22023';
  end if;
  if exists (select 1 from public.timetable_entries where import_id = p_import and live) then
    raise exception 'That import is already live' using errcode = '22023';
  end if;
  insert into public.timetable_imports (department_id, term, week_of, source_kind, source_name,
    parser_version, report, created_by)
  values (v_imp.department_id, v_imp.term, v_imp.week_of, 'revert', v_imp.source_name,
    v_imp.parser_version, jsonb_build_object('reverted_from', p_import), auth.uid())
  returning id into v_new;
  insert into public.timetable_entries (import_id, department_id, term, week_of, class_group_id,
    course_id, course_code, course_title, teacher_id, teacher_name, room_id, room_label, day,
    start_min, end_min, practical, combined_key, raw)
  select v_new, department_id, term, week_of, class_group_id, course_id, course_code, course_title, teacher_id,
    teacher_name, room_id, room_label, day, start_min, end_min, practical, combined_key, raw
  from public.timetable_entries where import_id = p_import and not excluded;
  perform public.publish_import(v_new);
  return v_new;
end;
$$;

-- ===========================================================================
-- Calendar writes.
-- ===========================================================================
create or replace function public.save_calendar_event(
  p_id uuid, p_term text, p_kind public.calendar_kind, p_title text, p_notes text,
  p_starts_on date, p_ends_on date, p_tentative boolean, p_source text, p_status text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uni uuid := public.my_university_id();
  v_id uuid;
  v_before jsonb;
begin
  if not public.can_edit_calendar(v_uni) then
    raise exception 'You can''t edit the calendar' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.calendar_events (university_id, term, kind, title, notes, starts_on,
      ends_on, tentative, source, status, created_by)
    values (v_uni, p_term, p_kind, trim(p_title), nullif(trim(p_notes), ''), p_starts_on,
      p_ends_on, coalesce(p_tentative, false), nullif(trim(p_source), ''), coalesce(p_status, 'draft'),
      auth.uid())
    returning id into v_id;
  else
    select to_jsonb(c) into v_before from public.calendar_events c
    where id = p_id and university_id = v_uni;
    if v_before is null then
      raise exception 'Event not found' using errcode = '22023';
    end if;
    update public.calendar_events
       set term = p_term, kind = p_kind, title = trim(p_title), notes = nullif(trim(p_notes), ''),
           starts_on = p_starts_on, ends_on = p_ends_on, tentative = coalesce(p_tentative, false),
           source = nullif(trim(p_source), ''), status = coalesce(p_status, status),
           updated_at = now()
     where id = p_id
    returning id into v_id;
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  select auth.uid(), 'calendar.save', 'calendar_event', v_id, v_before, to_jsonb(c)
  from public.calendar_events c where c.id = v_id;
  return v_id;
end;
$$;

create or replace function public.delete_calendar_event(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  select to_jsonb(c) into v_before from public.calendar_events c
  where id = p_id and public.can_edit_calendar(c.university_id);
  if v_before is null then
    raise exception 'Event not found' using errcode = '42501';
  end if;
  delete from public.calendar_events where id = p_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, before)
  values (auth.uid(), 'calendar.delete', 'calendar_event', p_id, v_before);
end;
$$;

revoke execute on function public.norm_person(text), public.is_data_editor(uuid, text),
  public.can_edit_calendar(uuid), public.grant_data_editor(uuid, uuid, text[]),
  public.revoke_data_editor(uuid, uuid),
  public.stage_import(uuid, text, date, text, text, text, jsonb, jsonb),
  public.import_diff(uuid), public.exclude_entry(uuid, boolean), public.publish_import(uuid),
  public.discard_import(uuid), public.revert_import(uuid),
  public.save_calendar_event(uuid, text, public.calendar_kind, text, text, date, date, boolean, text, text),
  public.delete_calendar_event(uuid)
  from public, anon;
grant execute on function public.norm_person(text), public.is_data_editor(uuid, text),
  public.can_edit_calendar(uuid), public.grant_data_editor(uuid, uuid, text[]),
  public.revoke_data_editor(uuid, uuid),
  public.stage_import(uuid, text, date, text, text, text, jsonb, jsonb),
  public.import_diff(uuid), public.exclude_entry(uuid, boolean), public.publish_import(uuid),
  public.discard_import(uuid), public.revert_import(uuid),
  public.save_calendar_event(uuid, text, public.calendar_kind, text, text, date, date, boolean, text, text),
  public.delete_calendar_event(uuid)
  to authenticated, service_role;

-- ===========================================================================
-- Data: UoS terms for 2026-27 and the academic calendar from the signed circular
-- SU/DIRACAD/751 (Office of the Director Academics, 3 Aug 2026).
-- ===========================================================================
insert into public.academic_terms (code, university_id, name, starts_on, ends_on)
select t.code, u.id, t.name, t.s::date, t.e::date
from public.universities u,
  (values ('2026-fall', 'Fall 2026', '2026-09-01', '2027-01-29'),
          ('2027-spring', 'Spring 2027', '2027-02-01', '2027-06-18'),
          ('2027-summer', 'Summer 2027', '2027-06-21', '2027-08-31')) as t(code, name, s, e)
where u.slug = 'uos'
on conflict (code) do nothing;

insert into public.calendar_events (university_id, term, kind, title, notes, starts_on, ends_on,
  tentative, source, status)
select u.id, c.term, c.kind::public.calendar_kind, c.title,
  case c.mark
    when '*' then 'Subject to the Government of Punjab declaring the public holiday.'
    when '**' then 'Subject to the moon sighting.'
    when '***' then 'Off days may be used for exams if needed.'
    else c.note end,
  c.s::date, c.e::date, coalesce(c.mark in ('*', '**'), false),
  'Academic Calendar 2026-27, circular SU/DIRACAD/751 (3 Aug 2026)', 'published'
from public.universities u,
  (values
    ('2026-fall', 'term', 'Classes begin (all semesters except new 1st semester)', null, null, '2026-09-01', null),
    ('2026-fall', 'term', 'Classes begin for new 1st-semester students', null, null, '2026-09-07', null),
    ('2026-fall', 'add_drop', 'Last day to enrol or change courses', null, null, '2026-09-14', null),
    ('2026-fall', 'withdraw', 'Last day to withdraw from a course', null, null, '2026-09-25', null),
    ('2026-fall', 'deadline', 'MS/MPhil/MSc (Hons)/PhD thesis submission (Fall admissions)', null, null, '2026-09-30', null),
    ('2026-fall', 'midterm', 'Midterm exams', '***', null, '2026-11-02', '2026-11-06'),
    ('2026-fall', 'holiday', 'Iqbal Day', '*', null, '2026-11-09', null),
    ('2026-fall', 'holiday', 'Quaid-e-Azam Day', '*', null, '2026-12-25', null),
    ('2026-fall', 'final', 'Final exams', '***', null, '2027-01-04', '2027-01-12'),
    ('2026-fall', 'other', 'PhD comprehensive exam', null, null, '2027-01-13', '2027-01-15'),
    ('2026-fall', 'deadline', 'Six-monthly report due, PhD and MS/MPhil/MSc (Hons) scholars (July to December)', null, null, '2027-01-15', null),
    ('2026-fall', 'result', 'Results declared', null, null, '2027-01-18', null),
    ('2026-fall', 'break', 'Semester break', null, null, '2027-01-19', '2027-01-29'),
    ('2027-spring', 'term', 'Classes begin', null, null, '2027-02-01', null),
    ('2027-spring', 'holiday', 'Kashmir Solidarity Day', '*', null, '2027-02-05', null),
    ('2027-spring', 'add_drop', 'Last day to enrol or change courses', null, null, '2027-02-09', null),
    ('2027-spring', 'withdraw', 'Last day to withdraw from a course', null, null, '2027-02-26', null),
    ('2027-spring', 'deadline', 'MS/MPhil/MSc (Hons)/PhD thesis submission (Spring admissions)', null, null, '2027-03-01', null),
    ('2027-spring', 'holiday', 'Eid-ul-Fitr', '**', null, '2027-03-09', '2027-03-11'),
    ('2027-spring', 'holiday', 'Pakistan Day', '*', null, '2027-03-23', null),
    ('2027-spring', 'midterm', 'Midterm exams', '***', null, '2027-03-29', '2027-04-02'),
    ('2027-spring', 'holiday', 'Labour Day', '*', null, '2027-05-01', null),
    ('2027-spring', 'holiday', 'Eid-ul-Azha', '**', null, '2027-05-16', '2027-05-18'),
    ('2027-spring', 'holiday', 'Youm-e-Takbeer', '*', null, '2027-05-28', null),
    ('2027-spring', 'final', 'Final exams', '***', null, '2027-06-03', '2027-06-11'),
    ('2027-spring', 'holiday', 'Youm-e-Ashura', '**', null, '2027-06-15', null),
    ('2027-spring', 'result', 'Results declared', null, null, '2027-06-18', null),
    ('2027-summer', 'registration', 'Summer registration and fee submission', null, 'Summer semester is for undergraduate programs only.', '2027-06-21', '2027-06-26'),
    ('2027-summer', 'term', 'Summer classes begin', null, 'Summer semester is for undergraduate programs only.', '2027-06-28', null),
    ('2027-summer', 'other', 'PhD comprehensive exam', null, null, '2027-07-05', '2027-07-09'),
    ('2027-summer', 'deadline', 'Six-monthly report due, PhD and MS/MPhil/MSc (Hons) scholars (January to June)', null, null, '2027-07-16', null),
    ('2027-summer', 'midterm', 'Summer midterm exams', '*', null, '2027-07-26', '2027-07-30'),
    ('2027-summer', 'holiday', 'Independence Day', '*', null, '2027-08-14', null),
    ('2027-summer', 'final', 'Summer final exams', '***', null, '2027-08-23', '2027-08-27'),
    ('2027-summer', 'result', 'Summer results declared', null, null, '2027-08-31', null)
  ) as c(term, kind, title, mark, note, s, e)
where u.slug = 'uos';
