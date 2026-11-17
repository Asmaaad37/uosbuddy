-- C18: a message signals every member's private inbox, and only you can read yours.
-- C19: one chat by id; the list capped. C20: the digest rotates. C21: notifications age out
-- after 90 days, and older pages load.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C');
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
create table tests.ids (name text primary key, id uuid);
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
grant usage on schema tests to authenticated;
grant select on tests.u, tests.ids to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-inbox@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Inbox ' || u.name, handle = 'inbox_' || lower(u.name)
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status) values
  (tests.uid('A'), tests.uid('B'), 'accepted'), (tests.uid('A'), tests.uid('C'), 'accepted');

-- ---------- C18 ----------
insert into tests.ids values ('ab', tests.as('A', format('select public.start_dm(%L)', tests.uid('B')))::uuid);
insert into tests.ids values ('ac', tests.as('A', format('select public.start_dm(%L)', tests.uid('C')))::uuid);
select tests.as('A', format('select (public.send_message(%L, %L)).body', tests.id('ab'), 'Notes?'));

select is((select count(*)::int from realtime.messages
           where topic = 'inbox:' || tests.uid('B') and event = 'message'
             and payload->>'conversation_id' = tests.id('ab')::text), 1,
  'a message signals the other member''s inbox');
select is((select count(*)::int from realtime.messages
           where topic = 'inbox:' || tests.uid('A') and event = 'message'), 1,
  '…and the sender''s, for their other devices');
select is((select count(*)::int from realtime.messages where topic = 'inbox:' || tests.uid('C')), 0,
  'nobody outside the chat is signalled');
select is((select count(*)::int from realtime.messages
           where topic = 'inbox:' || tests.uid('B') and payload ? 'body'), 0,
  'the signal carries no message text');
select is(tests.as('B', format('select public.can_read_topic(%L)::text', 'inbox:' || tests.uid('B'))), 'true',
  'you can listen to your own inbox');
select is(tests.as('C', format('select public.can_read_topic(%L)::text', 'inbox:' || tests.uid('B'))), 'false',
  '…and not anyone else''s');

-- ---------- C19 ----------
-- Inside one transaction now() never moves; make A's chat with C the older one.
update public.conversations set created_at = now() - interval '1 hour' where id = tests.id('ac');
select is(tests.as('A', format('select count(*)::text from public.my_conversations(%L)', tests.id('ac'))), '1',
  'opening one chat returns just that chat');
select is(tests.as('A', 'select count(*)::text from public.my_conversations(null, 1)'), '1',
  'the list stops at its limit');
select is(tests.as('A', 'select id::text from public.my_conversations(null, 1)'), tests.id('ab')::text,
  '…keeping the most recent chat');

-- ---------- C20 ----------
insert into public.private_profile (user_id, personal_email)
select id, lower(name) || '-digest@example.com' from tests.u
on conflict (user_id) do update set personal_email = excluded.personal_email;
select public.mark_digest_considered(array[tests.uid('A')]);
select is((select count(*)::int from public.digest_recipients(1000) where user_id = tests.uid('A')), 0,
  'someone who just had a digest waits their turn');
select ok(exists (select 1 from public.digest_recipients(1000) where user_id = tests.uid('B')),
  'someone who never had one is due');

-- ---------- C21 ----------
insert into public.notifications (user_id, type, created_at) values
  (tests.uid('C'), 'system.test', now() - interval '100 days'),
  (tests.uid('C'), 'system.test', now() - interval '10 days'),
  (tests.uid('C'), 'system.test', now() - interval '1 day');
select public.notifications_housekeeping();
select is(tests.as('C', format('select count(*)::text from public.my_notifications(50, %L)', now() - interval '2 days')), '1',
  'notifications over 90 days old are gone, and older pages load');

select * from finish();
rollback;
