-- Phase 3 invites: one code per student, a preview anyone can see (first name and a count),
-- and redemption that counts each new student once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C'), ('U');
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
grant usage on schema tests to authenticated, anon;
grant select on tests.u to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-inv@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  full_name = case u.name when 'A' then 'Ayesha Khan' else 'Student ' || u.name end,
  department_id = (select id from public.departments where short_code = 'CS'),
  batch_year = 2024,
  onboarding_step = 4
from tests.u u where p.id = u.id;

-- Codes
create temp table code as select tests.as('A', 'select public.my_invite_code()') as c;
grant select on code to authenticated, anon;
select matches((select c from code), '^[a-z0-9]{8}$', 'a code is 8 lowercase letters and digits');
select is(tests.as('A', 'select public.my_invite_code()'), (select c from code), 'the same student always gets the same code');
select isnt(tests.as('B', 'select public.my_invite_code()'), (select c from code), 'each student has their own code');
select throws_ok($$ select tests.as('U', 'select public.my_invite_code()') $$, '42501', null,
  'unverified accounts cannot invite');
select is(tests.as('B', 'select count(*)::text from public.invites'), '1', 'students see only their own invite');

-- Preview
set local role anon;
select is((select first_name from public.invite_preview((select c from code))), 'Ayesha', 'the preview shows the first name only');
select is((select batch_count from public.invite_preview(upper((select c from code)))), 3,
  'and how many of the batch are here (A, B, C; not the unverified U), case-insensitive');
select is((select count(*)::int from public.invite_preview('nosuchxx')), 0, 'an unknown code previews nothing');
reset role;

-- Redemption
select is(tests.as('A', format('select public.redeem_invite(%L)::text', (select c from code))), 'false',
  'your own code does not count');
select is(tests.as('B', format('select public.redeem_invite(%L)::text', (select c from code))), 'true',
  'a new student counts');
select is(tests.as('B', format('select public.redeem_invite(%L)::text', (select c from code))), 'false',
  'but only once');
select is(tests.as('C', format('select public.redeem_invite(%L)::text', upper((select c from code)))), 'true',
  'codes are case-insensitive');
select is((select uses from public.invites where inviter_id = tests.uid('A')), 2, 'uses counts both');
select is(has_function_privilege('anon', 'public.redeem_invite(text)', 'execute'), false,
  'visitors cannot redeem');

select * from finish();
rollback;
