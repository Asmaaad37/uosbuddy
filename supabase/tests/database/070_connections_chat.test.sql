-- Phase 4: connections and chat. A, B, C are verified CS 2024 students, O another
-- department, U unverified. Everything is done as the students themselves.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C'), ('O'), ('U');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
-- Runs `p_sql` as student `p_name`; %1$L, %2$L… in it are replaced by A, B, C, O, U's ids.
create function tests.as(p_name text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute format(p_sql, tests.uid('A'), tests.uid('B'), tests.uid('C'), tests.uid('O'), tests.uid('U'))
    into v;
  execute 'reset role';
  return v;
end $$;
grant usage on schema tests to authenticated, anon;
grant select on tests.u to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-chat@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  full_name = 'Chat ' || u.name,
  handle = 'chat_' || lower(u.name),
  department_id = (select id from public.departments where short_code = case when u.name = 'O' then 'IT' else 'CS' end),
  batch_year = 2024, section = 'B', shift = 'morning', onboarding_step = 4
from tests.u u where p.id = u.id;

-- ---------- the connections table is never read directly ----------
select is(tests.as('A', 'select count(*)::text from public.connections'), '0',
  'students cannot read the connections table');
select is(has_function_privilege('authenticated', 'public.are_connected(uuid, uuid)', 'execute'), false,
  'students cannot ask whether two others are connected');

-- ---------- requests ----------
select is(tests.as('A', $q$ select public.request_connection(%2$L, 'Chai at the dhaba?') $q$), 'outgoing',
  'A asks B to connect');
select is(tests.as('A', 'select public.connection_state(%2$L)'), 'outgoing', 'A sees it as outgoing');
select is(tests.as('B', 'select public.connection_state(%1$L)'), 'incoming', 'B sees it as incoming');
select is(tests.as('B', 'select message from public.incoming_requests()'), 'Chai at the dhaba?',
  'B sees the note in their requests');
select is(tests.as('B', 'select public.respond_connection(%1$L, false)'), 'none', 'B declines');
select is(tests.as('A', 'select public.connection_state(%2$L)'), 'outgoing',
  'A is not told they were declined');
select is(tests.as('A', 'select public.request_connection(%2$L)'), 'outgoing',
  'asking again within 30 days changes nothing');
select is(tests.as('B', 'select count(*)::text from public.incoming_requests()'), '0',
  'and does not reappear in B''s requests');
select is(tests.as('B', 'select public.request_connection(%1$L)'), 'outgoing',
  'B can still change their mind and ask A');
select is(tests.as('A', 'select public.request_connection(%2$L)'), 'connected',
  'asking someone who asked you connects you');
select is(tests.as('B', 'select public.connection_state(%1$L)'), 'connected', 'both are connected');
select is(tests.as('A', 'select string_agg(handle, '','') from public.my_connections()'), 'chat_b',
  'A''s connections list B');

select throws_ok($$ select tests.as('U', 'select public.request_connection(%1$L)') $$, '42501', null,
  'unverified accounts cannot connect');
update public.privacy_settings set profile_visibility = 'batch' where user_id = tests.uid('A');
select throws_ok($$ select tests.as('O', 'select public.request_connection(%1$L)') $$, '42501', null,
  'you cannot connect with a profile you cannot see');

-- ---------- "connections" visibility now means something ----------
update public.privacy_settings set profile_visibility = 'connections' where user_id = tests.uid('A');
select is(tests.as('B', 'select count(*)::text from public.profiles_public where id = %1$L'), '1',
  'connections: a connection sees the profile');
select is(tests.as('C', 'select count(*)::text from public.profiles_public where id = %1$L'), '0',
  'connections: a batchmate who is not connected does not');
update public.privacy_settings set profile_visibility = 'everyone' where user_id = tests.uid('A');

-- ---------- DMs and message requests ----------
create temp table conv (name text primary key, id uuid);
grant select, insert on conv to authenticated;
insert into conv values ('AB', tests.as('A', 'select public.start_dm(%2$L)')::uuid);
select is(tests.as('B', 'select public.start_dm(%1$L)::text'), (select id::text from conv where name = 'AB'),
  'one DM per pair, whoever starts it');
select is(tests.as('A', format('select (public.send_message(%L, %L)).body', (select id from conv where name = 'AB'), 'Hi B!')),
  'Hi B!', 'A sends a message');
select is(tests.as('B', format('select unread::text from public.my_conversations() where id = %L', (select id from conv where name = 'AB'))),
  '1', 'B has one unread');
select is(tests.as('B', format('select is_request::text from public.my_conversations() where id = %L', (select id from conv where name = 'AB'))),
  'false', 'between connections it is not a request');
select tests.as('B', format('select public.mark_read(%L)', (select id from conv where name = 'AB')));
select is(tests.as('B', format('select unread::text from public.my_conversations() where id = %L', (select id from conv where name = 'AB'))),
  '0', 'reading clears unread');

insert into conv values ('CA', tests.as('C', 'select public.start_dm(%1$L)')::uuid);
select is(tests.as('A', format('select count(*)::text from public.my_conversations() where id = %L', (select id from conv where name = 'CA'))),
  '0', 'an empty message request is not listed yet');
select tests.as('C', format('select public.send_message(%L, %L)', (select id from conv where name = 'CA'), 'Hey A'));
select is(tests.as('A', format('select is_request::text from public.my_conversations() where id = %L', (select id from conv where name = 'CA'))),
  'true', 'a message from a non-connection lands in Requests');
select tests.as('A', format('select public.send_message(%L, %L)', (select id from conv where name = 'CA'), 'Hi C'));
select is(tests.as('A', format('select is_request::text from public.my_conversations() where id = %L', (select id from conv where name = 'CA'))),
  'false', 'replying accepts the request');

update public.privacy_settings set allow_dms_from = 'connections' where user_id = tests.uid('O');
select throws_ok($$ select tests.as('C', 'select public.start_dm(%4$L)') $$, '42501', null,
  'allow_dms_from = connections stops strangers');

-- ---------- members only ----------
select is(tests.as('C', format('select count(*)::text from public.messages where conversation_id = %L', (select id from conv where name = 'AB'))),
  '0', 'non-members cannot read messages');
select throws_ok(format($$ select tests.as('C', 'select public.send_message(%L, ''sneaky'')') $$, (select id from conv where name = 'AB')),
  '42501', null, 'non-members cannot send');
select is(tests.as('C', format('select public.can_use_topic(%L)::text', 'conversation:' || (select id from conv where name = 'AB'))),
  'false', 'non-members cannot join the typing channel');
select is(tests.as('A', format('select public.can_use_topic(%L)::text', 'conversation:' || (select id from conv where name = 'AB'))),
  'true', 'members can');
select tests.as('C', format('select public.delete_message(%L)', (select id from public.messages where body = 'Hi B!')));
select is((select count(*)::int from public.messages where body = 'Hi B!' and deleted_at is null), 1,
  'you cannot delete someone else''s message');

-- ---------- blocks ----------
select tests.as('A', 'select public.block_user(%3$L)');
select throws_ok(format($$ select tests.as('C', 'select public.send_message(%L, ''still there?'')') $$, (select id from conv where name = 'CA')),
  '42501', null, 'a blocked student cannot DM');
select is(tests.as('A', format('select count(*)::text from public.my_conversations() where id = %L', (select id from conv where name = 'CA'))),
  '0', 'the DM disappears from the blocker''s list');
select is(tests.as('C', format('select count(*)::text from public.my_conversations() where id = %L', (select id from conv where name = 'CA'))),
  '0', 'and from the blocked student''s');
select throws_ok($$ select tests.as('C', 'select public.request_connection(%1$L)') $$, '42501', null,
  'a blocked student cannot ask to connect');

-- ---------- batch chats and groups ----------
select is(tests.as('A', 'select public.join_batch_chat(''batch'')::text'), tests.as('B', 'select public.join_batch_chat(''batch'')::text'),
  'the batch chat is created once and shared');
select is(tests.as('A', $q$ select title from public.my_conversations() where kind = 'batch' $q$), 'CS 2024',
  'it is named after the batch');
select throws_ok($$ select tests.as('A', 'select public.create_group(''Study'', null, array[%4$L]::uuid[])') $$, '42501', null,
  'groups only take your connections');

-- ---------- reports ----------
select tests.as('C', $q$ select public.report('profile', %1$L, 'spam') $q$);
select is(tests.as('C', 'select count(*)::text from public.reports'), '0', 'reporters cannot read reports');

select * from finish();
rollback;
