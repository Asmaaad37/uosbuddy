-- Deleting (hiding) a one-to-one chat from your list, and the Chats tab's unread count.
-- A, B and C are verified, connected CS 2024 students.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
-- Runs `p_sql` as student `p_name`; %1$L, %2$L, %3$L are A, B, C's ids, %4$L the A–B chat
-- and %5$L the group chat.
create function tests.as(p_name text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute format(p_sql, tests.uid('A'), tests.uid('B'), tests.uid('C'),
                 (select id from tests.chat where name = 'AB'),
                 (select id from tests.chat where name = 'G'))
    into v;
  execute 'reset role';
  return v;
end $$;
create table tests.chat (name text primary key, id uuid);
grant usage on schema tests to authenticated, anon;
grant select on tests.u, tests.chat to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-hide@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Hide ' || u.name, handle = 'hide_' || lower(u.name)
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status) values
  (tests.uid('A'), tests.uid('B'), 'accepted'), (tests.uid('A'), tests.uid('C'), 'accepted');

insert into tests.chat values ('AB', tests.as('A', 'select public.start_dm(%2$L)')::uuid);
select tests.as('A', $q$ select (public.send_message(%4$L, 'Notes from today?')).body $q$);
-- Inside one transaction now() never moves, so date the first message two minutes back
-- (as it would be in real life by the time B hides the chat).
update public.messages set created_at = created_at - interval '2 minutes'
where body = 'Notes from today?';

select is(has_function_privilege('anon', 'public.unread_chat_count()', 'execute'), false,
  'signed-out visitors have no count');
select is(tests.as('B', 'select public.unread_chat_count()::text'), '1', 'B has 1 unread message');
select is(tests.as('B', 'select count(*)::text from public.my_conversations()'), '1',
  'the chat is in B''s list');

select lives_ok($$ select tests.as('B', 'select ''ok'' from public.hide_conversation(%4$L)') $$,
  'B deletes the chat from their list');
select is(tests.as('B', 'select count(*)::text from public.my_conversations()'), '0',
  'it is gone from B''s list');
select is(tests.as('B', 'select public.unread_chat_count()::text'), '0', 'and from B''s count');
select is(tests.as('A', 'select count(*)::text from public.my_conversations()'), '1',
  'A still has it');
select throws_ok($$ select tests.as('C', 'select ''ok'' from public.hide_conversation(%4$L)') $$,
  'P0002', null, 'C cannot touch a chat they are not in');

select is(tests.as('B', 'select public.start_dm(%1$L)::text'),
  (select id::text from tests.chat where name = 'AB'), 'messaging A again finds the same chat');
select is(tests.as('B', 'select count(*)::text from public.my_conversations()'), '1',
  'and brings it back, so it can open');
select is(tests.as('B', 'select public.unread_chat_count()::text'), '0',
  'without counting old messages as unread');
select tests.as('B', 'select ''hidden'' from public.hide_conversation(%4$L)');

-- Time passes (inside one transaction now() never moves), then A writes again.
update public.conversation_members set hidden_at = hidden_at - interval '1 minute',
  last_read_at = last_read_at - interval '1 minute'
where user_id = tests.uid('B');
select tests.as('A', $q$ select (public.send_message(%4$L, 'You there?')).body $q$);
select is(tests.as('B', 'select count(*)::text from public.my_conversations()'), '1',
  'a new message brings the chat back for B');
select is(tests.as('B', 'select public.unread_chat_count()::text'), '1',
  'and only the new message counts');

select tests.as('B', $q$ update public.conversation_members set muted = true
  where conversation_id = %4$L and user_id = %2$L returning 'muted' $q$);
select is(tests.as('B', 'select public.unread_chat_count()::text'), '0',
  'muted chats don''t count on the Chats tab');

insert into tests.chat values
  ('G', tests.as('A', $q$ select public.create_group('Study', null, array[%2$L]::uuid[]) $q$)::uuid);
select throws_ok($$ select tests.as('B', 'select ''ok'' from public.hide_conversation(%5$L)') $$,
  'P0002', null, 'group chats are left, not deleted');

select * from finish();
rollback;
