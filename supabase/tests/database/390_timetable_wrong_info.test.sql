-- Launch fix 4: students report wrong timetable info; editors see and close the queue.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Ali'), ('Sara'), ('Newbie');
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
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into public.academic_terms (code, university_id, name)
select public.current_term(), id, 'Current term' from public.universities where slug = 'uos'
on conflict (code) do nothing;
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p390@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'Newbie' then p.verification_status
                             else 'verified'::public.verification_status end,
  onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- One published class.
select tests.as('Admin', format(
  'select public.publish_import(public.stage_import(%L, %L, null, %L, null, %L, null, %L))::text',
  (select id from public.departments where short_code = 'CS'), public.current_term(), 'json', 'test',
  jsonb_build_array(jsonb_build_object(
    'program_id', (select id from public.programs where name = 'BS in Computer Science'),
    'intake_year', 2024, 'section', 'REG', 'course_code', 'CSCC-2001', 'course_title', 'Data Structures',
    'teacher_name', 'Dr. Test Teacher', 'building_code', 'MAB', 'room_code', 'CR-160',
    'room_label', 'MAB CR-160', 'day', 0, 'start_min', 630, 'end_min', 720))));
create function tests.entry() returns uuid language sql stable as $$
  select id from public.timetable_entries where course_title = 'Data Structures' and live limit 1;
$$;
grant execute on function tests.entry() to authenticated;

select ok(tests.as('Ali', format('select public.report_timetable(%L, null, %L, %L)::text',
  tests.entry(), 'room', 'It moved to CR-162')) is not null, 'a student reports a wrong room');
select is((select seen->>'room' from public.timetable_reports where reporter_id = tests.uid('Ali')),
  'MAB CR-160', 'the report keeps what the student saw');
select lives_ok(format('select tests.as(%L, %L)', 'Ali',
  format('select public.report_timetable(%L, null, %L)::text', tests.entry(), 'time')),
  'reporting the same class again');
select is((select count(*)::int from public.timetable_reports where reporter_id = tests.uid('Ali')), 1,
  'updates the open report instead of adding another');
select lives_ok(format('select tests.as(%L, %L)', 'Sara',
  format('select public.report_timetable(%L, null, %L)::text', tests.entry(), 'room')),
  'a second student reports it too');
select throws_ok(format('select tests.as(%L, %L)', 'Newbie',
  format('select public.report_timetable(%L, null, %L)::text', tests.entry(), 'room')),
  '42501', null, 'unverified students can''t report');

-- The queue.
select is(tests.as('Admin', 'select reports::text from public.timetable_report_queue()'), '2',
  'the admin sees one row with both reports');
select is(tests.as('Ali', 'select count(*)::text from public.timetable_report_queue()'), '0',
  'students don''t see the queue');
select throws_ok(format('select tests.as(%L, %L)', 'Ali',
  format('select public.resolve_timetable_report(%L, %L)::text',
    (select id from public.timetable_reports where reporter_id = tests.uid('Ali')), 'dismissed')),
  '42501', null, 'students can''t close reports');
select is(tests.as('Admin', format('select public.resolve_timetable_report(%L, %L)::text',
  (select id from public.timetable_reports where reporter_id = tests.uid('Ali')), 'fixed')), '2',
  'marking it fixed closes both reports');
select is(tests.as('Admin', 'select count(*)::text from public.timetable_report_queue()'), '0',
  'and the queue is empty');

select * from finish();
rollback;
