-- Launch fix 2: admins hear when verifications or timetable imports wait more than 24 hours,
-- and hear nothing when the queues are fine.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Mod'), ('Newbie');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
create function tests.alerts(p_name text, p_type text) returns int language sql stable as $$
  select count(*)::int from public.notifications where user_id = tests.uid(p_name) and type = p_type;
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p370@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  university_id = (select id from public.universities where slug = 'uos'),
  role = case u.name when 'Admin' then 'admin'::public.user_role
                     when 'Mod' then 'moderator'::public.user_role else p.role end
from tests.u u where p.id = u.id;

insert into public.academic_terms (code, university_id, name)
select public.current_term(), id, 'Current term' from public.universities where slug = 'uos'
on conflict (code) do nothing;

-- Start from empty queues (rolled back at the end).
delete from public.verification_requests where status = 'pending';
delete from public.timetable_imports where status = 'review';

-- Fresh queues: nothing to say.
insert into public.verification_requests (user_id, university_id)
select tests.uid('Newbie'), id from public.universities where slug = 'uos';
select is(public.admin_health_alerts(), 0, 'no alert while the oldest request is under 24 hours');

-- The request has now waited 30 hours.
update public.verification_requests set created_at = now() - interval '30 hours'
where user_id = tests.uid('Newbie');
select cmp_ok(public.admin_health_alerts(), '>=', 1, 'alerts go out once a request is over 24 hours old');
select is(tests.alerts('Admin', 'admin.verifications'), 1, 'the admin is told');
select is((select payload->>'count' from public.notifications
           where user_id = tests.uid('Admin') and type = 'admin.verifications'), '1',
          'with how many are waiting');
select is(tests.alerts('Mod', 'admin.verifications'), 0, 'moderators are not');

-- An import left in review for two days.
insert into public.timetable_imports (department_id, term, source_kind, source_name,
                                      parser_version, created_at)
select id, public.current_term(), 'json', 'stale', 'test', now() - interval '2 days'
from public.departments where short_code = 'CS';
select public.admin_health_alerts();
select is(tests.alerts('Admin', 'admin.imports'), 1, 'a stale import in review is reported');

select is(has_function_privilege('authenticated', 'public.admin_health_alerts()', 'execute'), false,
          'students cannot trigger the alerts');

select * from finish();
rollback;
