-- Launch fix 5: bulk alerts wait 0–90 s in the push queue; personal ones don't; the job sends
-- what's due exactly once.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Ali'), ('Sara');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p400@example.com', now(), 'authenticated', 'authenticated' from tests.u;
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
select id, 'https://push.example.com/' || name, 'k', 'a' from tests.u;
delete from app_private.push_queue;

select public.notify(tests.uid('Ali'), 'timetable.changed', null, null, null, '{"count": 1}');
select is((select count(*)::int from app_private.push_queue), 1, 'a timetable change is queued');
select ok((select send_after between now() and now() + interval '90 seconds'
           from app_private.push_queue), 'to go out within 90 seconds');

select public.notify(tests.uid('Ali'), 'connect.request', tests.uid('Sara'), null, null, '{}');
select is((select count(*)::int from app_private.push_queue), 1,
          'a personal notification is not queued (it pushes at once)');

-- Not due yet: nothing goes out.
select is(public.send_queued_pushes(), 0, 'nothing is sent before its time');

-- Now due.
update app_private.push_queue set send_after = now() - interval '1 second';
select is(public.send_queued_pushes(), 1, 'due pushes are sent');
select is(public.send_queued_pushes(), 0, 'and only once');

select is(has_function_privilege('authenticated', 'public.send_queued_pushes(int)', 'execute'), false,
          'students cannot run the queue');

select * from finish();
rollback;
