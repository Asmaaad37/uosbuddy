-- Phase 11.1, after testing with the CS department's Fall 2026 timetable:
-- 1. UoS admits in Fall and Spring, so "BS CS 2024 Regular" is two batches (semester 5, Fall
--    intake, and semester 6, Spring intake). Class groups now carry the intake season.
-- 2. The timetable lists rooms with no classes too; seed_rooms saves them for the free-room
--    finder. Online rooms are marked as online.

alter table public.class_groups
  add column intake_term text check (intake_term in ('fall', 'spring', 'summer'));
alter table public.class_groups
  drop constraint class_groups_department_id_program_id_intake_year_section_key;
alter table public.class_groups
  add constraint class_groups_cohort_key
  unique nulls not distinct (department_id, program_id, intake_year, intake_term, section);

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
  v_term text;
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
    v_term := nullif(r->>'intake_term', '');
    if v_term is not null and v_term not in ('fall', 'spring', 'summer') then
      raise exception 'Row %: intake term must be fall, spring or summer', v_n using errcode = '22023';
    end if;
    insert into public.class_groups (department_id, program_id, intake_year, intake_term, section, label)
    values (p_department, v_program.id, v_intake, v_term, v_section,
            v_program.name || ' · ' || coalesce(initcap(v_term) || ' ', '') || v_intake || ' · ' ||
            case v_section when 'REG' then 'Regular' when 'SS1' then 'Self Support 1' else 'Self Support 2' end)
    on conflict (department_id, program_id, intake_year, intake_term, section)
      do update set label = public.class_groups.label
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
              case when v_rcode ilike 'online%' then 'online'::public.room_kind
                   when coalesce((r->>'practical')::boolean, false) then 'lab'::public.room_kind
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


-- Rooms from the timetable's own room list, including rooms with no classes this term.
-- Rows are {building_code, room_code, room_label}; existing rooms are left as they are.
create or replace function public.seed_rooms(p_department uuid, p_rooms jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uni uuid;
  v_added int := 0;
  r jsonb;
  v_building uuid;
  v_bcode text;
  v_rcode text;
begin
  if not public.is_data_editor(p_department, 'timetable') then
    raise exception 'You can''t add rooms for this department' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) > 500 then
    raise exception 'Send up to 500 rooms' using errcode = '22023';
  end if;
  select university_id into v_uni from public.departments where id = p_department;
  for r in select value from jsonb_array_elements(p_rooms) loop
    v_rcode := left(nullif(trim(coalesce(r->>'room_code', '')), ''), 40);
    continue when v_rcode is null;
    v_building := null;
    v_bcode := nullif(upper(trim(coalesce(r->>'building_code', ''))), '');
    if v_bcode is not null and v_bcode ~ '^[A-Z0-9]{2,8}$' then
      insert into public.buildings (university_id, code) values (v_uni, v_bcode)
      on conflict (university_id, code) do update set code = excluded.code
      returning id into v_building;
    end if;
    continue when exists (select 1 from public.rooms
                          where university_id = v_uni and building_id is not distinct from v_building
                            and (code = v_rcode or v_rcode = any(aliases)));
    insert into public.rooms (university_id, building_id, code, name, department_id, kind)
    values (v_uni, v_building, v_rcode, left(trim(coalesce(r->>'room_label', v_rcode)), 80), p_department,
            case when v_rcode ilike 'online%' then 'online'::public.room_kind
                 when v_rcode ~* '^(L-|.*\mlab\M)' then 'lab'::public.room_kind
                 when v_rcode ~* 'hall' then 'hall'::public.room_kind
                 else 'lecture'::public.room_kind end)
    on conflict (university_id, building_id, code) do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;
  return v_added;
end;
$$;

update public.rooms set kind = 'online' where code ilike 'online%' and kind <> 'online';

revoke execute on function public.seed_rooms(uuid, jsonb) from public, anon;
grant execute on function public.seed_rooms(uuid, jsonb) to authenticated, service_role;
