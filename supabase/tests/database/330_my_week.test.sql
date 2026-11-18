-- Phase 11.2: My week. A student's classes come from the group their profile matches, with the
-- Fall or Spring batch told apart by semester; they can choose their group and follow others.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Fall'), ('Spring'), ('NoSem'), ('Unverified');
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
-- The semester that makes a 2024 batch the Fall (or Spring) intake in the current term.
create function tests.sem(p_season text) returns int language sql stable as $$
  select case split_part(public.current_term(), '-', 2)
    when 'fall' then case p_season when 'fall' then 5 else 6 end
    when 'spring' then case p_season when 'spring' then 5 else 6 end
  end;
$$;
create function tests.row(p_code text, p_title text, p_term text, p_day int) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'program_id', (select p.id from public.programs p join public.departments d on d.id = p.department_id
                   where d.short_code = 'CS' and p.name = 'BS in Computer Science'),
    'intake_year', 2024, 'intake_term', p_term, 'section', 'REG', 'course_code', p_code,
    'course_title', p_title, 'teacher_name', 'Dr. Ayesha Kausar', 'building_code', 'MAB',
    'room_code', 'CR-160', 'room_label', 'MAB CR-160', 'day', p_day, 'start_min', 480, 'end_min', 570);
$$;
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into public.academic_terms (code, university_id, name)
select public.current_term(), id, 'Current term' from public.universities where slug = 'uos'
on conflict (code) do nothing;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p112@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'Unverified' then 'unverified'::public.verification_status
                             else 'verified'::public.verification_status end,
  onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'),
  program_id = (select id from public.programs where name = 'BS in Computer Science'),
  batch_year = 2024, section = 'REG',
  semester = case u.name when 'Fall' then tests.sem('fall') when 'Spring' then tests.sem('spring')
                         when 'NoSem' then null else 5 end,
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- The admin publishes a term timetable with a Fall and a Spring 2024 batch.
select tests.as('Admin', format('select public.publish_import(public.stage_import(%L, %L, null, %L, null, %L, null, %L))::text',
  (select id from public.departments where short_code = 'CS'), public.current_term(), 'json', 'test',
  jsonb_build_array(
    tests.row('CSCC-3301', 'Fall batch class', 'fall', 0),
    tests.row('CSCC-3302', 'Spring batch class', 'spring', 1))));

select is(tests.as('Fall', $$select string_agg(c->>'course_title', ',') from jsonb_array_elements(public.my_timetable()->'classes') c$$),
  case when split_part(public.current_term(), '-', 2) = 'summer' then null else 'Fall batch class' end,
  'a Fall-intake student sees only their batch');
select is(tests.as('Spring', $$select string_agg(c->>'course_title', ',') from jsonb_array_elements(public.my_timetable()->'classes') c$$),
  case when split_part(public.current_term(), '-', 2) = 'summer' then null else 'Spring batch class' end,
  'a Spring-intake student sees only theirs');
select is(tests.as('Fall', $$select public.my_timetable()->>'matched'$$),
  case when split_part(public.current_term(), '-', 2) = 'summer' then null else 'profile' end,
  'the match comes from the profile');
select is(tests.as('NoSem', $$select public.my_timetable()->'group'$$), 'null',
  'with no semester, two batches of the same year can''t be told apart');
select is(tests.as('Unverified', $$select jsonb_array_length(public.my_timetable()->'classes')::text$$), '0',
  'unverified students see nothing');

-- Choosing a group overrides the profile.
select lives_ok($$select tests.as('NoSem', format('select public.set_my_class_group(%L)',
  (select id from public.class_groups where intake_term = 'spring' and intake_year = 2024 limit 1)))$$,
  'a student chooses their section');
select is(tests.as('NoSem', $$select (public.my_timetable()->>'matched') || ':' || (public.my_timetable()->'classes'->0->>'course_title')$$),
  'choice:Spring batch class', 'their choice is used');
select ok(tests.as('NoSem', $$select (public.my_timetable()->>'published_at') is not null$$)::boolean,
  'the screen shows when the timetable was last published');
select throws_ok($$select tests.as('NoSem', format('select public.set_my_class_group(%L)', gen_random_uuid()))$$,
  '22023', null, 'only real sections can be chosen');

-- Following another group's course adds it, marked with that group.
select lives_ok($$select tests.as('NoSem', format(
  'insert into public.timetable_follows (class_group_id, course_id) values (%L, %L) returning id::text',
  (select id from public.class_groups where intake_term = 'fall' and intake_year = 2024 limit 1),
  (select id from public.courses where code = 'CSCC-3301')))$$, 'a student follows a repeat course');
select is(tests.as('NoSem', $$select string_agg((c->>'course_title') || '/' || coalesce(c->>'group_label', 'mine'), ',' order by c->>'course_title')
  from jsonb_array_elements(public.my_timetable()->'classes') c$$),
  'Fall batch class/BS in Computer Science · Fall 2024 · Regular,Spring batch class/mine',
  'followed classes appear, labelled with their section');
select is(tests.as('NoSem', $$select count(*)::text from public.timetable_groups()$$), '2',
  'the section list shows groups with a published timetable');

select * from finish();
rollback;
