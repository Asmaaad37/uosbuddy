-- Phase 11.3: section, teacher and room views; every room for the free-room finder; and change
-- alerts: one notification per affected student per publish, followers included, preference
-- respected, other batches left alone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Fall'), ('Spring'), ('Follower'), ('Muted'), ('Unverified');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
create function tests.as(p_name text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $$;
create function tests.sem(p_season text) returns int language sql stable as $$
  select case split_part(public.current_term(), '-', 2)
    when 'fall' then case p_season when 'fall' then 5 else 6 end
    when 'spring' then case p_season when 'spring' then 5 else 6 end
  end;
$$;
create function tests.row(p_code text, p_title text, p_term text, p_room text, p_day int) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'program_id', (select p.id from public.programs p join public.departments d on d.id = p.department_id
                   where d.short_code = 'CS' and p.name = 'BS in Computer Science'),
    'intake_year', 2024, 'intake_term', p_term, 'section', 'REG', 'course_code', p_code,
    'course_title', p_title, 'teacher_name', 'Dr. Ayesha Kausar', 'building_code', 'MAB',
    'room_code', p_room, 'room_label', 'MAB ' || p_room, 'day', p_day, 'start_min', 480, 'end_min', 570);
$$;
create function tests.publish(p_rows jsonb) returns text language sql as $$
  select tests.as('Admin', format(
    'select public.publish_import(public.stage_import(%L, %L, null, %L, null, %L, null, %L))::text',
    (select id from public.departments where short_code = 'CS'), public.current_term(), 'json', 'test', p_rows));
$$;
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into public.academic_terms (code, university_id, name)
select public.current_term(), id, 'Current term' from public.universities where slug = 'uos'
on conflict (code) do nothing;
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p113@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'Unverified' then 'unverified'::public.verification_status
                             else 'verified'::public.verification_status end,
  onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'),
  program_id = (select id from public.programs where name = 'BS in Computer Science'),
  batch_year = case u.name when 'Follower' then 2023 else 2024 end, section = 'REG',
  semester = case u.name when 'Spring' then tests.sem('spring') else tests.sem('fall') end,
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;
insert into public.notification_prefs (user_id, timetable) values (tests.uid('Muted'), false);

-- First publish: the Fall batch's timetable is up.
select tests.publish(jsonb_build_array(
  tests.row('CSCC-3401', 'Databases', 'fall', 'CR-160', 0),
  tests.row('CSCC-3402', 'Networks', 'fall', 'CR-161', 1),
  tests.row('CSCC-3403', 'Spring class', 'spring', 'CR-162', 2)));

-- Views.
select is(tests.as('Fall', $$select count(*)::text from public.live_entries()$$), '3',
  'verified students see this week''s live classes');
select is(tests.as('Unverified', $$select count(*)::text from public.live_entries()$$), '0',
  'unverified students see none');
select is(tests.as('Fall', format($$select public.timetable_view('room', %L)->'classes'->0->>'course_title'$$,
  (select r.id from public.rooms r join public.buildings b on b.id = r.building_id where b.code = 'MAB' and r.code = 'CR-161'))),
  'Networks', 'a room''s week lists its classes');
select is(tests.as('Fall', format($$select jsonb_array_length(public.timetable_view('teacher', %L)->'classes')::text$$,
  (select id from public.teachers where name_norm = 'ayesha kausar' limit 1))), '3',
  'a teacher''s week lists every class they teach');
select is(tests.as('Fall', format($$select public.timetable_view('section', %L)->>'title'$$,
  (select id from public.class_groups where intake_term = 'spring' and intake_year = 2024 limit 1))),
  'BS in Computer Science · Spring 2024 · Regular', 'any section can be looked up');
select is(tests.as('Fall', $$select public.timetable_view('room', gen_random_uuid())::text$$), null,
  'unknown ids give nothing');
select tests.as('Admin', format('select public.seed_rooms(%L, %L)::text',
  (select id from public.departments where short_code = 'CS'),
  '[{"building_code": "OKM", "room_code": "CR-90", "room_label": "OKM CR-90"}]'));
select ok(tests.as('Fall', $$select bool_or(label = 'OKM CR-90')::text from public.timetable_rooms()$$)::boolean,
  'rooms with no classes are listed for the free-room finder');

select is((select count(*)::int from public.notifications
  where user_id = tests.uid('Fall') and type = 'timetable.published'),
  case when split_part(public.current_term(), '-', 2) = 'summer' then 0 else 1 end,
  'the first publish tells the batch their timetable is up, once');

-- The Follower (another batch) follows the Fall batch's Databases; the Muted student is in the
-- Fall batch but turned timetable alerts off.
select tests.as('Follower', format(
  'insert into public.timetable_follows (class_group_id, course_id) values (%L, %L) returning id::text',
  (select id from public.class_groups where intake_term = 'fall' and intake_year = 2024 limit 1),
  (select id from public.courses where code = 'CSCC-3401')));

-- Second publish: Databases moves room, Networks moves to another day.
select tests.publish(jsonb_build_array(
  tests.row('CSCC-3401', 'Databases', 'fall', 'CR-165', 0),
  tests.row('CSCC-3402', 'Networks', 'fall', 'CR-161', 3),
  tests.row('CSCC-3403', 'Spring class', 'spring', 'CR-162', 2)));

select is((select payload->>'count' || ' ' || (payload->'first'->>'kind') || ' ' || (payload->'first'->'after'->>'room_label')
  from public.notifications where user_id = tests.uid('Fall') and type = 'timetable.changed'),
  case when split_part(public.current_term(), '-', 2) = 'summer' then null else '2 moved MAB CR-165' end,
  'one alert per student per publish, with the count and the most important change');
select is((select payload->>'count' from public.notifications
  where user_id = tests.uid('Follower') and type = 'timetable.changed'), '1',
  'a follower hears about the class they follow, not the rest');
select is((select count(*)::int from public.notifications
  where user_id = tests.uid('Spring') and type = 'timetable.changed'), 0,
  'the other batch hears nothing when nothing of theirs changed');
select is((select count(*)::int from public.notifications where user_id = tests.uid('Muted')), 0,
  'students who turned timetable alerts off get none');

select is(has_function_privilege('authenticated', 'public.notify_timetable_publish(uuid, boolean)', 'execute'),
  false, 'students can''t send timetable alerts');
select is(has_function_privilege('authenticated', 'public.class_group_students(uuid)', 'execute'),
  false, 'or list who is in a section');

select * from finish();
rollback;
