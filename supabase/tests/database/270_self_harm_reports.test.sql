-- A self-harm report goes to the top of the queue; push previews default to on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('R'), ('W'), ('Admin');
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
select id, lower(name) || '-care@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Care ' || u.name, handle = 'care_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;

-- Three spam reports on one post, one self-harm report on another, filed later.
insert into public.posts (id, university_id, author_id, space, body)
select '00000000-0000-0000-0000-00000000e001', university_id, tests.uid('W'), 'campus', 'Spammy'
from public.profiles where id = tests.uid('W');
insert into public.posts (id, university_id, author_id, space, body)
select '00000000-0000-0000-0000-00000000e002', university_id, tests.uid('W'), 'campus', 'I can''t do this any more'
from public.profiles where id = tests.uid('W');
insert into public.reports (reporter_id, target_type, target_id, reason, created_at)
select tests.uid(n), 'post', '00000000-0000-0000-0000-00000000e001', 'spam', now() - interval '1 hour'
from unnest(array['R', 'Admin']) n;

select lives_ok(format('select tests.as(''R'', %L)',
    'select ''done'' from public.report(''post'', ''00000000-0000-0000-0000-00000000e002'', ''self_harm'')'),
  'students can report that someone may hurt themselves');
select is(tests.as('Admin', 'select target_id::text from public.moderation_queue() limit 1'),
  '00000000-0000-0000-0000-00000000e002', 'it goes to the top of the queue, ahead of more-reported posts');
select throws_ok($$ insert into public.reports (reporter_id, target_type, target_id, reason)
  values (null, 'post', '00000000-0000-0000-0000-00000000e001', 'made_up') $$,
  '23514', null, 'other reasons are still refused');

select is((select previews from public.notification_prefs where user_id = tests.uid('R')), null,
  'nobody has a preference row until they change a setting');
insert into public.notification_prefs (user_id) values (tests.uid('R'));
select is((select previews from public.notification_prefs where user_id = tests.uid('R')), true,
  'message text shows by default');

select * from finish();
rollback;
