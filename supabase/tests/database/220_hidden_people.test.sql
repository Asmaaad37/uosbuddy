-- Banned, deleting and revoked students: their content is hidden from others, they can't read
-- chats, and undoing it brings everything back. A writes things, V reads them, Admin acts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('V'), ('Admin');
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
select id, lower(name) || '-hidden@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Hidden ' || u.name, handle = 'hidden_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status)
values (tests.uid('A'), tests.uid('V'), 'accepted');

-- What A has out there.
create table tests.chat (id uuid);
grant select on tests.chat to authenticated;
insert into public.posts (id, university_id, author_id, space, body)
select '00000000-0000-0000-0000-00000000c001', university_id, tests.uid('V'), 'campus', 'V post'
from public.profiles where id = tests.uid('V');
insert into public.posts (university_id, author_id, space, body)
select university_id, tests.uid('A'), 'campus', 'A post' from public.profiles where id = tests.uid('A');
insert into public.comments (post_id, author_id, body)
values ('00000000-0000-0000-0000-00000000c001', tests.uid('A'), 'A comment');
insert into public.events (university_id, title, starts_at, ends_at, venue, created_by)
select university_id, 'A event', now() + interval '1 day', now() + interval '2 days', 'Main hall', tests.uid('A')
from public.profiles where id = tests.uid('A');
insert into public.courses (department_id, code, title)
select id, 'HID101', 'Hidden course' from public.departments where short_code = 'CS';
insert into public.resources (course_id, uploader_id, kind, title, file_path, mime_type, size_bytes)
select id, tests.uid('A'), 'notes', 'A notes', 'hidden/a.pdf', 'application/pdf', 1
from public.courses where code = 'HID101';
insert into tests.chat select tests.as('A', format('select public.start_dm(%L)', tests.uid('V')))::uuid;
select tests.as('V', format($q$ select (public.send_message(%L, 'Hello there')).body $q$, (select id from tests.chat)));
insert into auth.sessions (id, user_id) values (gen_random_uuid(), tests.uid('A'));
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (tests.uid('A'), 'https://push.test/a', 'k', 'a');

-- How many of A's things V can see, and A's own access to the chat.
create function tests.seen(p_sql text) returns text language sql as $$
  select tests.as('V', p_sql);
$$;
create function tests.posts() returns text language sql as $$
  select tests.seen($q$ select count(*)::text from public.posts_public where body = 'A post' $q$);
$$;
create function tests.chat_rows(p_who text) returns text language sql as $$
  select tests.as(p_who, 'select count(*)::text from public.messages');
$$;

-- ---------- before: everything shows ----------
select is(tests.posts(), '1', 'V sees A''s post');
select is(tests.seen($q$ select count(*)::text from public.comments_public where body = 'A comment' $q$), '1', 'and comment');
select is(tests.seen($q$ select count(*)::text from public.feed_page('campus', 'new') where body = 'A post' $q$), '1', 'and the post in the feed');
select is(tests.seen($q$ select count(*)::text from public.events_board() where title = 'A event' $q$), '1', 'and event');
select is(tests.seen($q$ select count(*)::text from public.resources where title = 'A notes' $q$), '1', 'and notes');
select is(tests.chat_rows('A'), '1', 'A reads their chat');

-- ---------- a ban ----------
select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.ban_user(%L, ''Spam'')', tests.uid('A'))),
  'an admin bans A');
select is(tests.posts(), '0', 'A''s post is hidden');
select is(tests.seen($q$ select count(*)::text from public.comments_public where body = 'A comment' $q$), '0', 'and comment');
select is(tests.seen($q$ select count(*)::text from public.feed_page('campus', 'new') where body = 'A post' $q$), '0', 'and the feed');
select is(tests.seen($q$ select count(*)::text from public.events_board() where title = 'A event' $q$), '0', 'and event');
select is(tests.seen($q$ select count(*)::text from public.resources where title = 'A notes' $q$), '0', 'and notes');
select is(tests.seen(format('select public.blocked_with(%L)::text', tests.uid('A'))), 'true',
  'and rides, listings and backup requests, which all ask blocked_with');
select is(tests.chat_rows('A'), '0', 'A can''t read chat messages');
select is(tests.as('A', 'select count(*)::text from public.my_conversations()'), '0', 'or list chats');
select is(tests.as('A', format('select public.is_member(%L)::text', (select id from tests.chat))), 'false',
  'or open chat photos and live updates');
select is(tests.chat_rows('V'), '1', 'V keeps the chat');
select is((select count(*)::int from auth.sessions where user_id = tests.uid('A')), 0, 'A is signed out');
select is((select count(*)::int from public.push_subscriptions where user_id = tests.uid('A')), 0, 'and gets no more pushes');

select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.unban_user(%L)', tests.uid('A'))),
  'an admin unbans A');
select is(tests.posts(), '1', 'A''s post is back');
select is(tests.chat_rows('A'), '1', 'and so is their chat');

-- ---------- deleting an account ----------
select lives_ok($$ select tests.as('A', 'select ''done'' from public.request_account_deletion()') $$, 'A asks to delete their account');
select is(tests.posts(), '0', 'their post is hidden straight away');
select lives_ok($$ select tests.as('A', 'select ''done'' from public.cancel_account_deletion()') $$, 'A changes their mind');
select is(tests.posts(), '1', 'and it''s back');

-- ---------- revoking verification ----------
select throws_ok(format('select tests.as(''V'', %L)', format('select ''done'' from public.revoke_verification(%L, ''Not a student'')', tests.uid('A'))),
  '42501', null, 'students can''t revoke verification');
select throws_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.revoke_verification(%L, '''')', tests.uid('A'))),
  '22023', null, 'it needs a reason');
select throws_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.revoke_verification(%L, ''Not a student'')', tests.uid('Admin'))),
  '22023', null, 'admins can''t be revoked');
select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.revoke_verification(%L, ''Not a student'')', tests.uid('A'))),
  'an admin revokes A');
select is((select verification_status::text from public.profiles where id = tests.uid('A')), 'rejected', 'A is no longer verified');
select is((select decision_reason from public.verification_requests where user_id = tests.uid('A')), 'Not a student',
  'and sees the reason');
select is((select count(*)::int from public.audit_log where action = 'user.verification_revoked' and target_id = tests.uid('A')), 1,
  'it''s audited');
select is(tests.posts(), '0', 'their post is hidden');
select throws_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.revoke_verification(%L, ''Not a student'')', tests.uid('A'))),
  '22023', null, 'and it can''t be revoked twice');

select * from finish();
rollback;
