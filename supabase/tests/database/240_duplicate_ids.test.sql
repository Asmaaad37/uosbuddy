-- Reviewers are told when a roll number is already used by another account. N is applying with
-- a number that B (banned) used; F applies with a number nobody else has.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('N'), ('B'), ('F'), ('Admin'), ('S');
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
select id, lower(name) || '-dup@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set university_id = (select university_id from public.departments where short_code = 'CS'),
  full_name = 'Dup ' || u.name,
  verification_status = case when u.name in ('Admin', 'S', 'B') then 'verified' else 'pending' end::public.verification_status,
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end,
  banned_at = case when u.name = 'B' then now() end
from tests.u u where p.id = u.id;
update public.private_profile set roll_no = 'BSCS51F22S037' where user_id in (tests.uid('N'), tests.uid('B'));
update public.private_profile set registration_no = 'BSCS51F22S999' where user_id = tests.uid('F');
insert into public.verification_requests (user_id, university_id, status, roll_no_submitted, full_name_submitted)
select p.id, p.university_id, 'pending', case when p.id = tests.uid('N') then 'BSCS51F22S037' else 'BSCS51F22S999' end, p.full_name
from public.profiles p where p.id in (tests.uid('N'), tests.uid('F'));

create function tests.dups(p_who text, p_applicant text) returns text language sql as $$
  select tests.as(p_who, format(
    $q$ select coalesce(string_agg(d.full_name || ':' || d.status, ','), 'none') from public.verification_duplicates() d
        join public.verification_requests r on r.id = d.request_id where r.user_id = %L $q$, tests.uid(p_applicant)));
$$;

select is(tests.dups('Admin', 'N'), 'Dup B:banned', 'an admin sees who else used the number, and that they''re banned');
select is(tests.dups('Admin', 'F'), 'none', 'a number nobody else has isn''t flagged');
select is(tests.as('S', 'select count(*)::text from public.verification_duplicates()'), '0', 'students see nothing');
select is(has_function_privilege('anon', 'public.verification_duplicates()', 'execute'), false, 'nor do signed-out visitors');

-- A registration number can match someone else's roll number, either way round.
update public.private_profile set roll_no = 'BSCS51F22S999' where user_id = tests.uid('S');
select is(tests.dups('Admin', 'F'), 'Dup S:verified', 'a number stored as either kind is found');

-- Only what's waiting for a decision.
update public.verification_requests set status = 'rejected' where user_id = tests.uid('N');
select is(tests.dups('Admin', 'N'), 'none', 'decided requests aren''t listed');
select ok(exists (select 1 from pg_indexes where indexname = 'private_profile_roll_no_idx'), 'the lookup is indexed');

select * from finish();
rollback;
