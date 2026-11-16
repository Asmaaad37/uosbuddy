-- C2: Backup points once a week per pair; no re-claiming after stepping back.
-- C5: leaving a course leaves its chat and study groups; last term's courses are offered.
-- C6: restore only undoes staff removals; comment counts follow moderation.
-- C7: mentorships can end. C8: the same class can't be saved twice.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('R'), ('H'), ('T'), ('S'), ('Admin'), ('M'), ('E');
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
grant usage on schema tests to authenticated;
grant select on tests.u, tests.ids to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-c2c8@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Fair ' || u.name, handle = 'fair_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- ---------- C2: two friends trading requests ----------
insert into tests.ids values ('one', tests.as('R', $q$ select public.create_backup('Need a calculator', null, 'item') $q$)::uuid);
select tests.as('H', format('select public.claim_backup(%L)::text', tests.id('one')));
select tests.as('R', format('select public.resolve_backup(%L)', tests.id('one')));
insert into tests.ids values ('two', tests.as('R', $q$ select public.create_backup('Need lab notes', null, 'notes') $q$)::uuid);
select tests.as('H', format('select public.claim_backup(%L)::text', tests.id('two')));
select tests.as('R', format('select public.resolve_backup(%L)', tests.id('two')));

select is((select points from public.backup_points where user_id = tests.uid('H')), 10,
  'the same pair earns points once a week');
select is((select points_awarded::int from public.backup_requests where id = tests.id('two')), 0,
  'the repeat is still marked done, without points');
select is(tests.as('R', format('select helped::text from public.backup_leaderboard() where user_id = %L', tests.uid('H'))), '1',
  'the board counts the pair once');

insert into tests.ids values ('three', tests.as('R', $q$ select public.create_backup('Need a ride', null, 'ride') $q$)::uuid);
select tests.as('H', format('select public.claim_backup(%L)::text', tests.id('three')));
select tests.as('H', format('select public.unclaim_backup(%L)', tests.id('three')));
select throws_ok(format('select tests.as(%L, %L)', 'H', format('select public.claim_backup(%L)::text', tests.id('three'))),
  '22023', null, 'stepping back means you can''t claim it again');

-- ---------- C5: courses ----------
insert into public.courses (id, department_id, code, title)
values ('00000000-0000-0000-0000-0000000c5001', (select id from public.departments where short_code = 'CS'),
        'CS-590', 'Fair Systems');
insert into tests.ids values ('course', '00000000-0000-0000-0000-0000000c5001');
select tests.as('T', format('select public.join_course(%L)', tests.id('course')));
insert into tests.ids values ('course_chat', tests.as('T', format('select public.join_course_chat(%L)', tests.id('course')))::uuid);
insert into tests.ids values ('study', tests.as('T', format('select public.create_study_group(%L, %L)', tests.id('course'), 'Exam prep'))::uuid);
select tests.as('T', format('select public.leave_course(%L)', tests.id('course')));
select is((select count(*)::int from public.conversation_members
           where user_id = tests.uid('T') and conversation_id in (tests.id('course_chat'), tests.id('study'))), 0,
  'leaving a course leaves its chat and study groups');
select is((select count(*)::int from public.enrollments where user_id = tests.uid('T') and course_id = tests.id('course')), 0,
  '…and its class list');

insert into public.enrollments (user_id, course_id, term) values (tests.uid('T'), tests.id('course'), '2020-spring');
select is(tests.as('T', 'select code from public.last_term_courses()'), 'CS-590',
  'a new term offers last term''s courses');

-- ---------- C6: restore and comment counts ----------
insert into public.posts (id, university_id, author_id, space, body)
select '00000000-0000-0000-0000-0000000c6001', university_id, tests.uid('S'), 'campus', 'Something I regret'
from public.profiles where id = tests.uid('S');
select tests.as('S', $q$ select public.delete_post('00000000-0000-0000-0000-0000000c6001') $q$);
select throws_ok($$ select tests.as('Admin', $q$ select public.moderate_content('post', '00000000-0000-0000-0000-0000000c6001', 'restore') $q$) $$,
  '22023', null, 'staff can''t republish a post its author deleted');

insert into public.posts (id, university_id, author_id, space, body, comment_count)
select '00000000-0000-0000-0000-0000000c6002', university_id, tests.uid('S'), 'campus', 'Exam tips?', 1
from public.profiles where id = tests.uid('S');
insert into public.comments (id, post_id, author_id, body)
values ('00000000-0000-0000-0000-0000000c6003', '00000000-0000-0000-0000-0000000c6002', tests.uid('R'), 'Spam spam');
select tests.as('Admin', $q$ select public.moderate_content('comment', '00000000-0000-0000-0000-0000000c6003', 'hide') $q$);
select is((select comment_count from public.posts where id = '00000000-0000-0000-0000-0000000c6002'), 0,
  'removing a comment lowers the count');
-- now() is fixed inside one transaction; in real life the restore comes later than the removal.
update public.audit_log set created_at = created_at - interval '1 minute'
where target_id = '00000000-0000-0000-0000-0000000c6003' and action = 'content.hide';
select tests.as('Admin', $q$ select public.moderate_content('comment', '00000000-0000-0000-0000-0000000c6003', 'restore') $q$);
select is((select comment_count from public.posts where id = '00000000-0000-0000-0000-0000000c6002'), 1,
  'restoring it raises the count again');
select is((select status from public.comments where id = '00000000-0000-0000-0000-0000000c6003'), 'published',
  'staff can restore what they removed');
select throws_ok($$ select tests.as('Admin', $q$ select public.moderate_content('comment', '00000000-0000-0000-0000-0000000c6003', 'restore') $q$) $$,
  '22023', null, 'and restore only once');

-- ---------- C7: mentorships ----------
insert into public.mentorships (mentor_id, mentee_id, status, responded_at)
values (tests.uid('M'), tests.uid('E'), 'accepted', now());
select is(tests.as('E', 'select i_am from public.my_mentorships()'), 'mentee', 'a mentee sees their mentor');
select tests.as('E', format('select public.end_mentorship(%L)', tests.uid('M')));
select is((select status from public.mentorships where mentor_id = tests.uid('M') and mentee_id = tests.uid('E')), 'ended',
  'either person can end it');
select is((select count(*)::int from public.notifications where user_id = tests.uid('M') and type = 'mentor.ended'), 1,
  'the other person is told');
select throws_ok(format('select tests.as(%L, %L)', 'E', format('select public.end_mentorship(%L)', tests.uid('M'))),
  'P0002', null, 'there''s nothing left to end');

-- ---------- C8: timetable ----------
insert into public.timetable_slots (user_id, term, day, start_min, end_min, label)
values (tests.uid('T'), public.current_term(), 1, 540, 630, 'DSA');
select throws_ok($$ insert into public.timetable_slots (user_id, term, day, start_min, end_min, label)
  values (tests.uid('T'), public.current_term(), 1, 540, 630, 'DSA again') $$,
  '23505', null, 'the same class time can''t be saved twice');
select lives_ok($$ insert into public.timetable_slots (user_id, term, day, start_min, end_min, label)
  values (tests.uid('T'), public.current_term(), 1, 540, 630, 'DSA again')
  on conflict do nothing $$, 'a re-import skips classes already there');

select * from finish();
rollback;
