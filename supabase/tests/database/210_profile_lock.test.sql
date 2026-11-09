-- A student with their own login can't rewrite protected profile fields: every write goes
-- through a checked function. A and B are verified, finished students; Admin is an admin.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('Admin');
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

create table tests.d as
  select d.id as dept, d.short_code, p.id as prog, p.duration_semesters as n,
         row_number() over (order by d.short_code) as r
  from public.departments d
  join lateral (select * from public.programs where department_id = d.id order by name limit 1) p on true
  order by d.short_code limit 3;
grant select on tests.d to authenticated;
-- save_my_academic and request_studies_change for this row of tests.d.
create function tests.academic(p_r int, p_batch int, p_section text default 'REG', p_shift text default 'morning')
returns text language sql stable as $$
  select format('select ''ok'' from public.save_my_academic(%L, %L, %s, 1, %L, %L)',
                dept, prog, p_batch, p_section, p_shift)
  from tests.d where r = p_r;
$$;
create function tests.request(p_r int, p_batch int, p_section text, p_doc text) returns text
language sql stable as $$
  select format('select ''ok'' from public.request_studies_change(%L, %L, %s, 1, %L, ''morning'', %L)',
                dept, prog, p_batch, p_section, p_doc)
  from tests.d where r = p_r;
$$;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-lock@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  department_id = (select dept from tests.d where r = 1),
  program_id = (select prog from tests.d where r = 1), batch_year = 2024, shift = 'morning',
  section = case when u.name = 'A' then 'REG' end,
  full_name = 'Lock ' || u.name, handle = 'lock_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- ---------- direct writes are gone ----------
select is(has_table_privilege('authenticated', 'public.profiles', 'update'), false,
  'students have no direct update on profiles');
select throws_ok($$ select tests.as('A', 'update public.profiles set batch_year = 2019 where id = auth.uid() returning ''x''') $$,
  '42501', null, 'a student cannot change their batch directly');
select throws_ok($$ select tests.as('A', 'update public.profiles set handle = ''admin'' where id = auth.uid() returning ''x''') $$,
  '42501', null, 'or their handle');
select throws_ok($$ select tests.as('A', 'update public.profiles set full_name = ''UOSBuddy Support'' where id = auth.uid() returning ''x''') $$,
  '42501', null, 'or their name');
select throws_ok($$ select tests.as('A', 'update public.profiles set deleted_at = null, onboarding_step = 4 where id = auth.uid() returning ''x''') $$,
  '42501', null, 'or their deletion and setup state');

-- ---------- handles ----------
create function tests.about(p_handle text, p_avatar text default null) returns text language sql stable as $$
  select format('select ''ok'' from public.save_my_about(%L, ''bio'', ''Sargodha'', ''hostelite'', %L)', p_handle, p_avatar);
$$;
select throws_ok(format('select tests.as(''A'', %L)', tests.about('admin')), '22023', null,
  'reserved handles are refused');
select throws_ok(format('select tests.as(''A'', %L)', tests.about('Sup_port')), '22023', null,
  'even with an underscore');
select throws_ok(format('select tests.as(''A'', %L)', tests.about('xxshitxx')), '22023', null,
  'blocked words are refused anywhere in a handle');
select lives_ok(format('select tests.as(''A'', %L)', tests.about('lock_alpha')),
  'an ordinary handle saves');
select is((select handle::text from public.profiles where id = tests.uid('A')), 'lock_alpha',
  'and it was saved');
select throws_ok(format('select tests.as(''A'', %L)',
    tests.about('lock_alpha', 'https://x.test/storage/v1/object/public/avatars/' || tests.uid('B') || '/1-512.webp')),
  '22023', null, 'a photo must be in your own folder');

-- ---------- interests: the 10-interest trigger locks the profile row ----------
select lives_ok(format('select tests.as(''A'', %L)',
    format('select ''ok'' from public.set_my_interests(array[%L]::uuid[])',
           (select id from public.interests order by sort limit 1))),
  'a student can still save their interests');
select is((select count(*)::int from public.profile_interests where user_id = tests.uid('A')), 1,
  'and they were saved');

-- ---------- after setup: only program, semester and empty fields are free ----------
insert into public.conversations (id, kind, title, batch_key)
values ('00000000-0000-0000-0000-00000000b001', 'batch', 'Old batch', 'batch:lock:2024'),
       ('00000000-0000-0000-0000-00000000b002', 'batch', 'Old section', 'section:lock:2024:REG:morning');
insert into public.conversation_members (conversation_id, user_id, accepted_at)
values ('00000000-0000-0000-0000-00000000b001', tests.uid('A'), now()),
       ('00000000-0000-0000-0000-00000000b002', tests.uid('A'), now());
insert into storage.objects (bucket_id, name)
values ('verification-docs', tests.uid('A') || '/proof.jpg');

select lives_ok(format('select tests.as(''A'', %L)', tests.academic(1, 2024)),
  'saving the same studies is free');
select throws_ok(format('select tests.as(''A'', %L)', tests.academic(2, 2024)), '42501', null,
  'a new department needs proof');
select throws_ok(format('select tests.as(''A'', %L)', tests.academic(1, 2023)), '42501', null,
  'a new session needs proof');
select throws_ok(format('select tests.as(''A'', %L)', tests.academic(1, 2024, 'SS1')), '42501', null,
  'a new section needs proof');
select throws_ok(format('select tests.as(''A'', %L)', tests.academic(1, 2024, 'REG', 'evening')), '42501', null,
  'a new shift needs proof');
select lives_ok(format('select tests.as(''B'', %L)', tests.academic(1, 2024, 'SS2')),
  'picking a section for the first time is free');
select throws_ok(format('select tests.as(''B'', %L)', tests.academic(1, 2024, 'SS1')), '42501', null,
  'but only the first time');
select throws_ok(format('select tests.as(''Admin'', %L)', tests.academic(1, 2024, 'A')), '22023', null,
  'sections other than REG, SS1 and SS2 are refused');
select throws_ok($$ update public.profiles set section = 'A' where id = tests.uid('B') $$, '23514', null,
  'and the table itself refuses them');

-- ---------- asking for a change ----------
select throws_ok(format('select tests.as(''A'', %L)', tests.request(2, 2023, 'SS1', tests.uid('A') || '/missing.jpg')),
  '22023', null, 'a request needs an uploaded proof');
select throws_ok(format('select tests.as(''A'', %L)', tests.request(2, 2023, 'SS1', tests.uid('B') || '/proof.jpg')),
  '22023', null, 'and the proof must be in your own folder');
select throws_ok(format('select tests.as(''A'', %L)', tests.request(1, 2024, 'REG', tests.uid('A') || '/proof.jpg')),
  '22023', null, 'and something must actually change');
select lives_ok(format('select tests.as(''A'', %L)', tests.request(2, 2023, 'SS1', tests.uid('A') || '/proof.jpg')),
  'a student can ask for a change with proof');
select is((select batch_year from public.profiles where id = tests.uid('A')), 2024,
  'asking changes nothing yet');
select is(tests.as('B', 'select count(*)::text from public.studies_change_requests'), '0',
  'other students cannot see the request');
select is(tests.as('Admin', 'select count(*)::text from public.studies_change_requests'), '1',
  'admins can');

-- ---------- deciding ----------
create function tests.pending() returns uuid language sql stable security definer as $$
  select id from public.studies_change_requests where status = 'pending' limit 1;
$$;
grant execute on function tests.pending() to authenticated;
create function tests.decide(p_approve boolean, p_reason text default null) returns text language sql stable as $$
  select format('select ''ok'' from public.decide_studies_change(%L, %L, %L)', tests.pending(), p_approve, p_reason);
$$;
select throws_ok(format('select tests.as(''A'', %L)', tests.decide(true)), '42501', null,
  'a student cannot approve their own request');
select throws_ok(format('select tests.as(''Admin'', %L)', tests.decide(false)), '22023', null,
  'rejecting needs a reason');
select lives_ok(format('select tests.as(''Admin'', %L)', tests.decide(false, 'Blurry photo')),
  'an admin can reject');
select is((select studies_changed_at from public.profiles where id = tests.uid('A')), null,
  'a rejection does not use up the change');
select lives_ok(format('select tests.as(''A'', %L)', tests.request(2, 2023, 'SS1', tests.uid('A') || '/proof.jpg')),
  'so they can try again');
select lives_ok(format('select tests.as(''Admin'', %L)', tests.decide(true)), 'an admin can approve');
select is((select row(department_id = (select dept from tests.d where r = 2), batch_year, section)::text
           from public.profiles where id = tests.uid('A')),
  '(t,2023,SS1)', 'approving applies the change');
select is((select count(*)::int from public.conversation_members
           where user_id = tests.uid('A') and conversation_id in
             ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002')),
  0, 'and takes them out of their old batch and section chats');
select is((select array_agg(type order by created_at, type) from public.notifications where user_id = tests.uid('A')),
  array['studies.approved', 'studies.rejected'], 'the student is told both times');
select throws_ok(format('select tests.as(''A'', %L)', tests.request(3, 2022, 'REG', tests.uid('A') || '/proof.jpg')),
  '42501', null, 'a second change is refused');
select throws_ok(format('select tests.as(''B'', %L)', format('select ''ok'' from public.allow_studies_change(%L)', tests.uid('A'))),
  '42501', null, 'students cannot allow another change');
select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''ok'' from public.allow_studies_change(%L)', tests.uid('A'))),
  'an admin can');
select lives_ok(format('select tests.as(''A'', %L)', tests.request(3, 2022, 'REG', tests.uid('A') || '/proof.jpg')),
  'and then the student can ask once more');

-- ---------- nobody passes through section chats during setup ----------
update public.profiles set onboarding_step = 2 where id = tests.uid('B');
select throws_ok($$ select tests.as('B', 'select public.join_batch_chat(''section'')::text') $$,
  '22023', null, 'section chats open only after setup');

select * from finish();
rollback;
