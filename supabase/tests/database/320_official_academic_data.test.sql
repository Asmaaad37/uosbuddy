-- Phase 11.1: official timetable imports and the academic calendar.
-- Students read only published data; only data editors (or admins) stage, publish and revert;
-- the diff names moved, retimed, teacher, added and removed classes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Student'), ('Editor'), ('Admin'), ('Other'), ('Unverified');
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
create table tests.ids (name text primary key, id uuid);
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
-- A minimal timetable row for BS CS, intake 2024, Regular.
create function tests.row(p_code text, p_title text, p_room text, p_teacher text,
  p_day int, p_start int, p_end int) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'program_id', (select p.id from public.programs p join public.departments d on d.id = p.department_id
                   where d.short_code = 'CS' and p.name = 'BS in Computer Science'),
    'intake_year', 2024, 'section', 'REG', 'course_code', p_code, 'course_title', p_title,
    'teacher_name', p_teacher, 'building_code', 'MAB', 'room_code', p_room,
    'room_label', 'MAB ' || p_room, 'day', p_day, 'start_min', p_start, 'end_min', p_end);
$$;
grant usage on schema tests to authenticated;
grant select on tests.u, tests.ids to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p11@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'Unverified' then 'unverified'::public.verification_status
                             else 'verified'::public.verification_status end,
  onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- Calendar: the circular is loaded and published; unverified users see nothing.
select ok((select count(*) from public.calendar_events where status = 'published') >= 35,
  'the 2026-27 calendar is loaded');
select is(tests.as('Student', $$select count(*)::text from public.calendar_events
  where title = 'Results declared' and starts_on = '2027-01-18'$$), '1',
  'students see the Fall result date from the circular');
select is(tests.as('Unverified', $$select count(*)::text from public.calendar_events$$), '0',
  'unverified users see no calendar');
select is(tests.as('Student', $$select tentative::text from public.calendar_events where title = 'Eid-ul-Fitr'$$),
  'true', 'moon-dependent holidays are tentative');

-- Editors: only admins grant; a student can't stage.
select throws_ok($$select tests.as('Student', format('select public.grant_data_editor(%L, %L)',
  tests.uid('Student'), (select id from public.departments where short_code = 'CS')))$$,
  '42501', null, 'students can''t make themselves editors');
select lives_ok($$select tests.as('Admin', format('select public.grant_data_editor(%L, %L, %L)',
  tests.uid('Editor'), (select id from public.departments where short_code = 'CS'), '{timetable}'))$$,
  'admins grant editor rights');
select is((select count(*)::int from public.audit_log where action = 'data_editor.grant'
  and target_id = tests.uid('Editor')), 1, 'granting is audited');
select throws_ok($$select tests.as('Student', format(
  'select public.stage_import(%L, %L, null, %L, null, %L, null, %L)::text',
  (select id from public.departments where short_code = 'CS'), '2026-fall', 'json', 'test',
  jsonb_build_array(tests.row('CSCC-2201', 'Database Systems', 'CR-160', 'Dr. Ayesha Kausar', 0, 480, 570))))$$,
  '42501', null, 'students can''t import timetables');
select throws_ok($$select tests.as('Editor', format(
  'select public.save_calendar_event(null, %L, %L, %L, null, %L, null, false, null, %L)::text',
  '2026-fall', 'holiday', 'Made-up holiday', '2026-12-01', 'published'))$$,
  '42501', null, 'a timetable-only editor can''t edit the calendar');

-- First import: staged rows aren't visible to students until published.
insert into tests.ids select 'imp1', tests.as('Editor', format(
  'select public.stage_import(%L, %L, null, %L, %L, %L, %L, %L)::text',
  (select id from public.departments where short_code = 'CS'), '2026-fall', 'json', 'week4.json', 'test',
  '{"pages": 1}', jsonb_build_array(
    tests.row('CSCC-2201', 'Database Systems', 'CR-160', 'Dr. Ayesha Kausar', 0, 480, 570),
    tests.row('CSCC-2202', 'Computer Networks', 'CR-161', 'Mr. Ali Raza', 1, 600, 690),
    tests.row('CSCC-2203', 'Operating Systems', 'CR-162', 'Ms. Sana Iqbal', 2, 480, 570),
    tests.row('CSCC-2204', 'Theory of Automata', 'CR-163', 'Dr. Ayesha Kausar', 3, 480, 570))))::uuid;
select is(tests.as('Student', $$select count(*)::text from public.timetable_live$$), '0',
  'staged classes stay hidden');
select is(tests.as('Student', format('select count(*)::text from public.timetable_entries where import_id = %L',
  tests.id('imp1'))), '0', 'students can''t read staged rows');
select is((select count(*)::int from public.rooms r join public.buildings b on b.id = r.building_id
  where b.code = 'MAB' and r.code in ('CR-160', 'CR-161', 'CR-162', 'CR-163')), 4,
  'rooms are seeded from the timetable''s labels');
select is((select count(*)::int from public.teachers where name_norm = 'ayesha kausar'), 1,
  'one teacher row per person, titles ignored');
select is((select label from public.class_groups g join public.timetable_entries e on e.class_group_id = g.id
  where e.import_id = tests.id('imp1') limit 1), 'BS in Computer Science · 2024 · Regular',
  'class groups are labelled from program, intake and section');
select is(tests.as('Editor', format('select count(*)::text from public.import_diff(%L) where kind = %L',
  tests.id('imp1'), 'added')), '4', 'a first import adds every class');
select lives_ok($$select tests.as('Editor', format('select public.publish_import(%L)::text', tests.id('imp1')))$$,
  'the editor publishes');
select is(tests.as('Student', $$select count(*)::text from public.timetable_live$$), '4',
  'students see the published week');
select is(tests.as('Unverified', $$select count(*)::text from public.timetable_live$$), '0',
  'unverified users still see nothing');

-- Second import: one moved, one retimed (new day), one new teacher, one removed, one added.
insert into tests.ids select 'imp2', tests.as('Editor', format(
  'select public.stage_import(%L, %L, null, %L, null, %L, null, %L)::text',
  (select id from public.departments where short_code = 'CS'), '2026-fall', 'json', 'test',
  jsonb_build_array(
    tests.row('CSCC-2201', 'Database Systems', 'CR-170', 'Dr. Ayesha Kausar', 0, 480, 570),
    tests.row('CSCC-2202', 'Computer Networks', 'CR-161', 'Mr. Ali Raza', 4, 600, 690),
    tests.row('CSCC-2203', 'Operating Systems', 'CR-162', 'Dr. Bilal Ahmed', 2, 480, 570),
    tests.row('CSCC-2205', 'Software Engineering', 'CR-163', 'Ms. Sana Iqbal', 3, 600, 690))))::uuid;
select is(tests.as('Editor', format(
  $$select string_agg(kind, ',' order by kind) from public.import_diff(%L)$$, tests.id('imp2'))),
  'added,moved,removed,retimed,teacher', 'the diff names each kind of change');
select is(tests.as('Editor', format('select public.publish_import(%L)::text', tests.id('imp2')))::jsonb,
  '{"added": 1, "moved": 1, "removed": 1, "retimed": 1, "teacher": 1}'::jsonb,
  'publishing returns the summary');
select is(tests.as('Student', $$select string_agg(course_title, ',' order by course_title) from public.timetable_live$$),
  'Computer Networks,Database Systems,Operating Systems,Software Engineering',
  'only the newest import is live');
select is(tests.as('Student', format('select count(*)::text from public.timetable_changes where import_id = %L',
  tests.id('imp2'))), '5', 'students can read what changed');
select throws_ok($$select tests.as('Editor', format('select public.publish_import(%L)::text', tests.id('imp2')))$$,
  '22023', null, 'an import publishes once');

-- Revert to the first import.
select lives_ok($$select tests.as('Editor', format('select public.revert_import(%L)::text', tests.id('imp1')))$$,
  'the editor restores the earlier timetable');
select is(tests.as('Student', $$select string_agg(room_label, ',' order by room_label) from public.timetable_live$$),
  'MAB CR-160,MAB CR-161,MAB CR-162,MAB CR-163', 'the restored timetable is live');

-- Follows are private.
select lives_ok($$select tests.as('Student', format(
  'insert into public.timetable_follows (class_group_id) values (%L) returning id::text',
  (select id from public.class_groups limit 1)))$$, 'students follow a class group');
select is(tests.as('Other', $$select count(*)::text from public.timetable_follows$$), '0',
  'nobody else sees who follows what');

select * from finish();
rollback;
