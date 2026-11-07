-- "Notify me": students join or leave a feature's waitlist; only an admin can announce,
-- each waiting student is told once, and banned students are skipped.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('A'), ('B'), ('C'), ('Banned');
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
create function tests.told(p_name text) returns int language sql stable as $$
  select count(*)::int from public.notifications
  where user_id = tests.uid(p_name) and type = 'feature.live';
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-waitlist@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = 'verified', onboarding_step = 4,
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  role = case when u.name = 'Admin' then 'admin' else 'student' end::public.user_role
from tests.u u where p.id = u.id;

select is(has_function_privilege('anon', 'public.set_waitlist(text, boolean)', 'execute'), false,
  'signed-out visitors cannot join');
select is(tests.as('A', $q$ select public.set_waitlist('aibuddy', true)::text $q$), 'true',
  'A taps Notify me');
select is(tests.as('A', $q$ select public.set_waitlist('aibuddy', true)::text $q$), 'true',
  'tapping again is harmless');
select is(tests.as('A', 'select count(*)::text from public.feature_waitlist'), '1',
  'A sees their own place on the list');
select is(tests.as('B', 'select count(*)::text from public.feature_waitlist'), '0',
  'B cannot see who else is waiting');
select throws_ok($$ select tests.as('A', $q$ select public.set_waitlist('jetpacks', true)::text $q$) $$,
  'P0002', null, 'only known features have a list');

do $d$ begin
  perform tests.as('C', $q$ select public.set_waitlist('aibuddy', true)::text $q$);
  perform tests.as('Banned', $q$ select public.set_waitlist('aibuddy', true)::text $q$);
  perform tests.as('B', $q$ select public.set_waitlist('aibuddy', true)::text $q$);
end $d$;
select is(tests.as('B', $q$ select public.set_waitlist('aibuddy', false)::text $q$), 'false',
  'B changes their mind and leaves');
update public.profiles set banned_at = now() where id = tests.uid('Banned');

select is(tests.as('A', $q$ select public.waitlist_pending('aibuddy')::text $q$), null,
  'students do not see the count');
select is(tests.as('Admin', $q$ select public.waitlist_pending('aibuddy')::text $q$), '2',
  'the admin sees 2 waiting (A and C; not B who left, nor the banned student)');
select throws_ok($$ select tests.as('A', $q$ select public.announce_feature('aibuddy')::text $q$) $$,
  '42501', null, 'students cannot announce');
select is(tests.as('Admin', $q$ select public.announce_feature('aibuddy')::text $q$), '2',
  'the admin announces to 2 students');
select is(tests.told('A') + tests.told('C'), 2, 'A and C each get one notification');
select is(tests.told('B') + tests.told('Banned'), 0, 'B and the banned student get none');
select is(tests.as('Admin', $q$ select public.announce_feature('aibuddy')::text $q$), '0',
  'announcing again tells nobody twice');

select * from finish();
rollback;
