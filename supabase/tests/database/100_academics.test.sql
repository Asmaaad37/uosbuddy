-- Phase 6: courses, enrolments, resources, timetables, free time, pings, study groups,
-- mentors. A and B are connected CS 2024 students; C is a CS student not connected to A;
-- S is a CS senior (2022, semester 7).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C'), ('S');
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
create temp table ids (name text primary key, id uuid);
grant select on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from ids where name = p_name;
$$;
grant execute on function tests.id(text) to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-acad@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = 'verified', onboarding_step = 4,
  full_name = 'Acad ' || u.name, handle = 'acad_' || lower(u.name),
  department_id = (select id from public.departments where short_code = 'CS'),
  batch_year = case when u.name = 'S' then 2022 else 2024 end,
  semester = case when u.name = 'S' then 7 else 1 end
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status)
values (tests.uid('A'), tests.uid('B'), 'accepted');

-- ---------- courses ----------
insert into ids values ('cs301', tests.as('A', format('select public.add_course(%L, %L, %L)',
  (select id from public.departments where short_code = 'CS'), 'cs 301', 'Data Structures'))::uuid);
select is((select code from public.courses where id = tests.id('cs301')), 'CS-301', 'codes are tidied to CS-301');
select is(tests.as('B', format('select public.add_course(%L, %L, %L)',
  (select id from public.departments where short_code = 'CS'), 'CS-301', 'whatever')), tests.id('cs301')::text,
  'the same code finds the same course, however it''s typed');
select throws_ok(format('select tests.as(%L, %L)', 'A', format('select public.add_course(%L, %L, %L)',
  (select id from public.departments where short_code = 'CS'), 'hello', 'Nope')),
  '22023', null, 'a code has to look like a course code');

-- ---------- enrolment ----------
select tests.as('A', format('select public.join_course(%L, %L)', tests.id('cs301'), 'b'));
select tests.as('B', format('select public.join_course(%L)', tests.id('cs301')));
select is(tests.as('A', format('select enrolled_count::text from public.course_overview(%L)', tests.id('cs301'))), '2',
  'the course counts who''s taking it this term');
select is(tests.as('A', 'select string_agg(code, '','') from public.my_courses()'), 'CS-301', 'my courses');
update public.privacy_settings set profile_visibility = 'nobody' where user_id = tests.uid('B');
select is(tests.as('A', format('select count(*)::text from public.course_people(%L)', tests.id('cs301'))), '0',
  'classmates who hide their profile are not listed');
update public.privacy_settings set profile_visibility = 'everyone' where user_id = tests.uid('B');
select is(tests.as('C', 'select count(*)::text from public.enrollments'), '0',
  'enrolments are private to each student');

-- ---------- course chat ----------
select throws_ok(format('select tests.as(%L, %L)', 'C', format('select public.join_course_chat(%L)', tests.id('cs301'))),
  '42501', null, 'only students taking the course can join its chat');
select is(tests.as('A', format('select public.join_course_chat(%L)::text', tests.id('cs301'))),
  tests.as('B', format('select public.join_course_chat(%L)::text', tests.id('cs301'))),
  'one chat per course');

-- ---------- resources ----------
insert into ids values ('res', tests.as('A', format('select public.add_resource(%L, %L, %L, %L, %L, %L)',
  tests.id('cs301'), 'notes', 'Week 1 notes', tests.id('cs301') || '/' || gen_random_uuid() || '.pdf',
  'application/pdf', 12345))::uuid);
select is(tests.as('C', format('select count(*)::text from public.resources where id = %L', tests.id('res'))), '1',
  'verified students can see published resources');
select throws_ok(format('select tests.as(%L, %L)', 'A', format('select public.add_resource(%L, %L, %L, %L, %L, %L)',
  tests.id('cs301'), 'notes', 'Wrong place', gen_random_uuid() || '/' || gen_random_uuid() || '.pdf', 'application/pdf', 1)),
  '22023', null, 'a file must sit in its course''s folder');
select is(tests.as('B', format('select public.vote_resource(%L, true)::text', tests.id('res'))), '1', 'upvotes count');
select tests.as('B', format('select public.report(''resource'', %L, ''spam'')', tests.id('res')));
select tests.as('C', format('select public.report(''resource'', %L, ''spam'')', tests.id('res')));
select tests.as('S', format('select public.report(''resource'', %L, ''spam'')', tests.id('res')));
select is((select status from public.resources where id = tests.id('res')), 'held', 'three reports hold a file');

-- ---------- timetables and free time ----------
insert into public.timetable_slots (user_id, term, day, start_min, end_min, label, room)
select tests.uid(n), public.current_term(), 0, 540, 630, 'DSA', 'Room 12' from unnest(array['A', 'B', 'C']) n;
select is(tests.as('C', 'select count(*)::text from public.timetable_slots where user_id <> auth.uid()'), '0',
  'nobody reads another student''s timetable');
select is(tests.as('A', format('select count(*)::text from public.busy_slots(array[%L, %L]::uuid[])', tests.uid('B'), tests.uid('C'))), '1',
  'free-time maths sees connections only (B, not C)');
update public.privacy_settings set share_free_time = false where user_id = tests.uid('B');
select is(tests.as('A', format('select count(*)::text from public.busy_slots(array[%L]::uuid[])', tests.uid('B'))), '0',
  'and not those who switched sharing off');

update public.privacy_settings set show_free_now = true where user_id = tests.uid('C');
select tests.as('C', 'select public.set_on_campus(2)');
select is(tests.as('A', $q$ select count(*)::text from public.free_now() where handle = 'acad_c' $q$),
  case when (extract(isodow from now() at time zone 'Asia/Karachi') = 1
             and (extract(hour from now() at time zone 'Asia/Karachi') * 60
                  + extract(minute from now() at time zone 'Asia/Karachi')) between 540 and 629)
       then '0' else '1' end,
  'who''s free now: opted in, on campus, and not in class right now');

-- ---------- pings ----------
insert into ids values ('ping', tests.as('A', format('select public.send_ping(%L)', tests.uid('C')))::uuid);
select ok((select expires_at between now() + interval '119 minutes' and now() + interval '121 minutes'
           from public.conversations where id = tests.id('ping')), 'a ping chat lasts 2 hours');
select is((select count(*)::int from public.notifications where user_id = tests.uid('C') and type = 'ping'), 1,
  'and notifies');
update public.privacy_settings set allow_dms_from = 'nobody' where user_id = tests.uid('S');
select throws_ok(format('select tests.as(%L, %L)', 'A', format('select public.send_ping(%L)', tests.uid('S'))),
  '42501', null, 'pings respect who can message you');

-- ---------- study groups ----------
insert into ids values ('sg', tests.as('A', format('select public.create_study_group(%L, %L, %L, 2)',
  tests.id('cs301'), 'DSA crew', 'Tue 3pm, library'))::uuid);
select tests.as('B', format('select public.join_study_group(id) from public.study_groups where conversation_id = %L', tests.id('sg')));
select tests.as('C', format('select public.join_course(%L)', tests.id('cs301')));
select throws_ok(format('select tests.as(%L, %L)', 'C',
    format('select public.join_study_group(id) from public.study_groups where conversation_id = %L', tests.id('sg'))),
  '22023', null, 'a full study group takes nobody else');

-- ---------- mentors ----------
select throws_ok($$ select tests.as('A', 'select public.set_mentor(true)') $$, '22023', null,
  'first-semester students can''t mentor yet');
select tests.as('S', 'select public.set_mentor(true)');
update public.privacy_settings set allow_dms_from = 'everyone' where user_id = tests.uid('S');
select is(tests.as('C', 'select string_agg(handle, '','') from public.find_mentors()'), 'acad_s',
  'juniors find seniors who mentor');
select tests.as('C', format('select public.request_mentor(%L, %L)', tests.uid('S'), 'Help with DSA?'));
select tests.as('S', format('select public.respond_mentorship(%L, true)', tests.uid('C')));
select is(tests.as('C', format('select public.connection_state(%L)', tests.uid('S'))), 'connected',
  'an accepted mentorship connects them');

-- ---------- Backup fan-out: same course first ----------
select is(tests.as('A', format('select public.create_backup(%L, null, %L, %L)::text is not null', 'Need DSA notes', 'notes', tests.id('cs301'))),
  'true', 'a request can name one of your courses');
select is((select count(*)::int from public.notifications n join public.backup_requests r on r.id = n.entity_id
           where n.type = 'backup.nearby' and r.course_id = tests.id('cs301') and n.user_id in (tests.uid('B'), tests.uid('C'))), 2,
  'classmates in the course are pinged');

select * from finish();
rollback;
