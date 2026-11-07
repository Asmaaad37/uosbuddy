-- Admin → Launch check: the status is admins only and never holds a secret; the test
-- notification goes to the admin who sent it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Student');
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

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-launch@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  full_name = 'Launch ' || u.name, handle = 'launch_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin' else p.role end
from tests.u u where p.id = u.id;

insert into app_private.config values ('push_url', 'https://example.test/api/push'),
  ('push_secret', 'very-secret-value')
on conflict (key) do update set value = excluded.value;

select is(has_function_privilege('anon', 'public.launch_status()', 'execute'), false,
  'signed-out visitors cannot read the launch status');
select throws_ok($$ select tests.as('Student', 'select public.launch_status()::text') $$,
  '42501', null, 'students cannot read it');
select is(tests.as('Admin', $q$ select public.launch_status() ->> 'push_url' $q$),
  'https://example.test/api/push', 'admins see where pushes go');
select is(tests.as('Admin', $q$ select public.launch_status() ->> 'push_secret' $q$), 'true',
  'and that the push secret is set');
select is(tests.as('Admin', $q$ select position('very-secret-value' in public.launch_status()::text)::text $q$),
  '0', 'but never the secret itself');
select ok(tests.as('Admin', $q$ select (public.launch_status() ->> 'admins') $q$)::int >= 1,
  'it counts admins');

select throws_ok($$ select tests.as('Student', 'select public.send_test_notification()::text') $$,
  '42501', null, 'students cannot send a test notification');
select lives_ok($$ select tests.as('Admin', 'select public.send_test_notification()::text') $$,
  'an admin sends one');
select is(
  (select string_agg(type, ',') from public.notifications where user_id = tests.uid('Admin')),
  'system.test', 'and it goes to that admin only');

select * from finish();
rollback;
