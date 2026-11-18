-- Phase 11.4: Free together and Free now count official classes; calendar reminders go out
-- two days before a date, once, and only for published dates.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Ali'), ('Sara');
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
-- Now in Pakistan: day (0 = Monday) and minute.
create function tests.pk_day() returns int language sql stable as $$
  select extract(isodow from now() at time zone 'Asia/Karachi')::int - 1;
$$;
create function tests.pk_min() returns int language sql stable as $$
  select (extract(hour from now() at time zone 'Asia/Karachi') * 60
          + extract(minute from now() at time zone 'Asia/Karachi'))::int;
$$;
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into public.academic_terms (code, university_id, name)
select public.current_term(), id, 'Current term' from public.universities where slug = 'uos'
on conflict (code) do nothing;
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p114@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'),
  program_id = (select id from public.programs where name = 'BS in Computer Science'),
  batch_year = 2024, section = 'REG', semester = null,
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- An official class happening right now (Pakistan time), for a section Sara chooses.
select tests.as('Admin', format(
  'select public.publish_import(public.stage_import(%L, %L, null, %L, null, %L, null, %L))::text',
  (select id from public.departments where short_code = 'CS'), public.current_term(), 'json', 'test',
  jsonb_build_array(jsonb_build_object(
    'program_id', (select id from public.programs where name = 'BS in Computer Science'),
    'intake_year', 2024, 'section', 'REG', 'course_code', 'CSCC-3501', 'course_title', 'Right now',
    'teacher_name', 'Dr. Ayesha Kausar', 'building_code', 'MAB', 'room_code', 'CR-160',
    'room_label', 'MAB CR-160', 'day', least(tests.pk_day(), 6),
    'start_min', greatest(tests.pk_min() - 30, 0), 'end_min', least(tests.pk_min() + 30, 1440)))));
select tests.as('Sara', format('select public.set_my_class_group(%L)',
  (select id from public.class_groups where intake_year = 2024 and intake_term is null limit 1)));

-- Free together: Sara's official class is busy time, for her and for Ali (connected, sharing).
insert into public.connections (requester_id, addressee_id, status, responded_at)
values (tests.uid('Ali'), tests.uid('Sara'), 'accepted', now());
select is(tests.as('Sara', format($$select count(*)::text from public.busy_slots(array[%L]::uuid[])$$,
  tests.uid('Sara'))), '1', 'my official class counts as busy for Free together');
select is(tests.as('Ali', format($$select count(*)::text from public.busy_slots(array[%L]::uuid[])$$,
  tests.uid('Sara'))), '1', 'and a connection who shares free time sees it as busy');
update public.privacy_settings set share_free_time = false where user_id = tests.uid('Sara');
select is(tests.as('Ali', format($$select count(*)::text from public.busy_slots(array[%L]::uuid[])$$,
  tests.uid('Sara'))), '0', 'unless they stop sharing');

-- Free now: on campus and opted in, but in an official class, so not listed.
insert into public.presence (user_id, on_campus_until) values (tests.uid('Sara'), now() + interval '2 hours');
update public.privacy_settings set show_free_now = true where user_id = tests.uid('Sara');
select is(tests.as('Ali', format($$select count(*)::text from public.free_now() where id = %L$$,
  tests.uid('Sara'))), '0', 'someone in an official class isn''t shown as free now');

-- Calendar reminders.
insert into public.calendar_events (university_id, term, kind, title, starts_on, status)
select id, null, 'deadline', 'Test deadline', (now() at time zone 'Asia/Karachi')::date + 2, 'published'
from public.universities where slug = 'uos';
insert into public.calendar_events (university_id, term, kind, title, starts_on, status)
select id, null, 'deadline', 'Draft date', (now() at time zone 'Asia/Karachi')::date + 2, 'draft'
from public.universities where slug = 'uos';
select lives_ok($$select tests.as('Ali', format(
  'insert into public.calendar_reminders (event_id) values (%L) returning event_id::text',
  (select id from public.calendar_events where title = 'Test deadline')))$$,
  'a student asks to be reminded');
select throws_ok($$select tests.as('Ali', format(
  'insert into public.calendar_reminders (event_id) values (%L) returning event_id::text',
  (select id from public.calendar_events where title = 'Draft date')))$$,
  '42501', null, 'not for dates that aren''t published');
select ok(tests.as('Sara', 'select public.remind_all_deadlines()::text')::int >= 1,
  '"Remind me of every deadline" adds the coming deadlines');

select is(public.calendar_reminders_due() >= 1, true, 'the daily job sends what''s due');
select is((select payload->>'title' from public.notifications
  where user_id = tests.uid('Ali') and type = 'calendar.reminder'), 'Test deadline',
  'the reminder names the date');
select is((select count(*)::int from public.notifications
  where user_id = tests.uid('Ali') and type = 'calendar.reminder' and payload->>'title' = 'Test deadline'
  and (select public.calendar_reminders_due()) >= 0), 1, 'and sends it only once');

select is(has_function_privilege('authenticated', 'public.user_busy(uuid)', 'execute'), false,
  'students can''t read anyone''s busy times directly');

select * from finish();
rollback;
