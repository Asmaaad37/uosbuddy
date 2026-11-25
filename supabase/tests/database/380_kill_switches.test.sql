-- Launch fix 3: the chat, sign-up and timetable-alert switches are enforced in the database,
-- and every switch is on unless an admin turns it off.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Ali');
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-p380@example.com', now(), 'authenticated', 'authenticated' from tests.u;

select ok(public.switch_on('chat') and public.switch_on('ai_buddy')
          and public.switch_on('timetable_alerts') and public.switch_on('signups'),
          'all four switches start on');
select ok(public.switch_on('no_such_switch'), 'a switch with no row counts as on');

insert into public.conversations (id, kind, title)
values ('00000000-0000-0000-0000-0000000c0380', 'group', 'Switch test');

-- Chat off: students can't send; system messages still go in.
update public.feature_flags set enabled = false where key = 'chat';
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     values ('00000000-0000-0000-0000-0000000c0380', (select id from tests.u), 'hi') $$,
  '55000', 'Chat is paused for a little while. Try again soon.',
  'a student''s message is refused while chat is off');
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     values ('00000000-0000-0000-0000-0000000c0380', null, 'System note') $$,
  'system messages still go in');
update public.feature_flags set enabled = true where key = 'chat';
select lives_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     values ('00000000-0000-0000-0000-0000000c0380', (select id from tests.u), 'back') $$,
  'sending works again once chat is back on');

-- Sign-ups off: no new accounts.
update public.feature_flags set enabled = false where key = 'signups';
select throws_ok(
  $$ insert into auth.users (id, email, aud, role)
     values (gen_random_uuid(), 'new-p380@example.com', 'authenticated', 'authenticated') $$,
  '55000', 'New sign-ups are paused', 'new accounts are refused while sign-ups are off');
update public.feature_flags set enabled = true where key = 'signups';
select lives_ok(
  $$ insert into auth.users (id, email, aud, role)
     values (gen_random_uuid(), 'new2-p380@example.com', 'authenticated', 'authenticated') $$,
  'and allowed again once back on');

-- Timetable alerts off: publishing sends nothing.
update public.feature_flags set enabled = false where key = 'timetable_alerts';
select is(public.notify_timetable_publish(gen_random_uuid(), false), 0,
          'no alerts while timetable alerts are off');

select is(has_function_privilege('authenticated', 'public.signup_switch_guard()', 'execute'), false,
          'the guards can''t be called directly');

select * from finish();
rollback;
