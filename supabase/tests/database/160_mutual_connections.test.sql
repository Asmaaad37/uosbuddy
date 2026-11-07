-- Feature #21: mutual connections. A, B, C, D, E are verified CS 2024 students, U is
-- unverified. A and B both know C and D; E is pending with A; B and C both know E.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C'), ('D'), ('E'), ('U');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
-- Runs `p_sql` as student `p_name`; %1$L…%6$L are A, B, C, D, E, U's ids.
create function tests.as(p_name text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute format(p_sql, tests.uid('A'), tests.uid('B'), tests.uid('C'), tests.uid('D'),
                 tests.uid('E'), tests.uid('U'))
    into v;
  execute 'reset role';
  return v;
end $$;
grant usage on schema tests to authenticated, anon;
grant select on tests.u to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-mutual@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  full_name = 'Mutual ' || u.name,
  handle = 'mutual_' || lower(u.name),
  department_id = (select id from public.departments where short_code = 'CS'),
  batch_year = 2024, onboarding_step = 4
from tests.u u where p.id = u.id;

insert into public.connections (requester_id, addressee_id, status) values
  (tests.uid('A'), tests.uid('C'), 'accepted'),
  (tests.uid('C'), tests.uid('B'), 'accepted'),
  (tests.uid('A'), tests.uid('D'), 'accepted'),
  (tests.uid('B'), tests.uid('D'), 'accepted'),
  (tests.uid('A'), tests.uid('E'), 'pending'),
  (tests.uid('B'), tests.uid('E'), 'accepted'),
  (tests.uid('C'), tests.uid('E'), 'accepted');

select is(has_function_privilege('anon', 'public.mutual_connections(uuid)', 'execute'), false,
  'signed-out visitors cannot ask');
select is(tests.as('A', 'select max(total)::text from public.mutual_connections(%2$L)'), '2',
  'A and B share C and D (a pending request does not count)');
select is(tests.as('A', $q$ select string_agg(full_name, ', ' order by full_name) from public.mutual_connections(%2$L) $q$),
  'Mutual C, Mutual D', 'they are C and D');
select is(tests.as('B', 'select max(total)::text from public.mutual_connections(%1$L)'), '2',
  'it works both ways');
select is(tests.as('A', 'select count(*)::text from public.mutual_connections(%1$L)'), '0',
  'nothing on your own profile');
select is(tests.as('U', 'select count(*)::text from public.mutual_connections(%2$L)'), '0',
  'an unverified student sees nothing');

-- D blocks A: D disappears from what A sees, and the count drops with it.
insert into public.blocks (blocker_id, blocked_id) values (tests.uid('D'), tests.uid('A'));
select is(tests.as('A', 'select max(total)::text from public.mutual_connections(%2$L)'), '1',
  'a mutual who blocked you is not shown or counted');
select is(tests.as('A', $q$ select string_agg(full_name, ', ' order by full_name) from public.mutual_connections(%2$L) $q$),
  'Mutual C', 'only C is left');

-- B hides their profile from everyone but connections; A is not connected to B.
update public.privacy_settings set profile_visibility = 'connections' where user_id = tests.uid('B');
select is(tests.as('A', 'select count(*)::text from public.mutual_connections(%2$L)'), '0',
  'nothing when you cannot see the profile');
select is(tests.as('C', 'select max(total)::text from public.mutual_connections(%2$L)'), '1',
  'C, connected to B, still sees what they share with B (E)');

select * from finish();
rollback;
