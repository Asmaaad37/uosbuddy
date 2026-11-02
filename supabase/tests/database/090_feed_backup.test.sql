-- Phase 5: feed, Backup requests, notifications. R requests/posts; H helps; O is in another
-- department; plus 60 classmates (C1…C60) in R's department batch for the fan-out cap.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('R'), ('H'), ('O'), ('M');
insert into tests.u (name) select 'C' || g from generate_series(1, 60) g;
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
select id, lower(name) || '-feed@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = 'verified', onboarding_step = 4,
  full_name = 'Feed ' || u.name, handle = 'feed_' || lower(u.name),
  department_id = (select id from public.departments where short_code = case when u.name = 'O' then 'IT' else 'CS' end),
  batch_year = case when u.name = 'M' then 2022 else 2024 end,
  section = case when u.name in ('R', 'H') then 'B' else 'A' end,
  is_mentor = u.name = 'M'
from tests.u u where p.id = u.id;

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from ids where name = p_name;
$$;
grant execute on function tests.id(text) to authenticated;

-- =========================== feed ===========================
select is(has_table_privilege('authenticated', 'public.posts', 'select')
          and not exists (select 1 from pg_policies where tablename = 'posts' and policyname <> 'posts_staff'),
  true, 'students have no policy on the posts table itself (only the staff one)');

select throws_ok($$ select tests.as('R', 'select public.create_post(''campus'', ''hi'', ''{}'', null, true)') $$,
  '42501', null, 'anonymous posting is off by default');
update public.feature_flags set enabled = true where key = 'anonymous_posts';

insert into ids values ('named', tests.as('R', $q$ select public.create_post('campus', 'Lost my ID card near the library') $q$)::uuid);
insert into ids values ('anon', tests.as('R', $q$ select public.create_post('campus', 'Is the 8am class worth it?', '{}', null, true) $q$)::uuid);
insert into ids values ('dept', tests.as('R', format($q$ select public.create_post(%L, 'CS only') $q$,
  'department:' || (select department_id from public.profiles where id = tests.uid('R'))))::uuid);

select is(tests.as('H', format('select author_handle from public.posts_public where id = %L', tests.id('named'))), 'feed_r',
  'named posts show their author');
select is(tests.as('H', format('select coalesce(author_id::text, ''null'') || '','' || coalesce(author_handle, ''null'') from public.posts_public where id = %L', tests.id('anon'))),
  'null,null', 'anonymous posts never expose the author''s id or handle');
select matches(tests.as('H', format('select author_name from public.posts_public where id = %L', tests.id('anon'))),
  '^[A-Za-z]+ #[0-9]{2}$', 'anonymous posts show an alias instead');
select is(tests.as('R', format('select is_mine::text from public.posts_public where id = %L', tests.id('anon'))), 'true',
  'the author can tell it is theirs');
select is(tests.as('H', format('select count(*)::text from public.posts where id = %L', tests.id('anon'))), '0',
  'students cannot read the posts table directly');
select is(tests.as('O', format('select count(*)::text from public.posts_public where id = %L', tests.id('dept'))), '0',
  'a department feed is hidden from other departments');
select is(tests.as('H', format('select count(*)::text from public.posts_public where id = %L', tests.id('dept'))), '1',
  'and visible to the department');
select throws_ok(format('select tests.as(%L, %L)', 'O',
    format('select public.create_post(%L, %L)', 'department:' || (select department_id from public.profiles where id = tests.uid('R')), 'sneaky')),
  '42501', null, 'you cannot post into another department''s feed');

-- votes and hot score
select tests.as('H', format('select public.vote_post(%L, 1)', tests.id('named')));
select tests.as('O', format('select public.vote_post(%L, 1)', tests.id('named')));
select tests.as('O', format('select public.vote_post(%L, -1)', tests.id('named')));
select is((select upvotes || '/' || downvotes from public.posts where id = tests.id('named')), '1/1',
  'changing a vote moves it, never double-counts');
select ok((select hot_score from public.posts where id = tests.id('named'))
          = public.hot_score(1, 1, (select created_at from public.posts where id = tests.id('named'))),
  'the hot score follows the votes');
select is(tests.as('H', format('select my_vote::text from public.posts_public where id = %L', tests.id('named'))), '1',
  'you see your own vote');

-- comments notify, anonymously when anonymous
select tests.as('H', format('select public.create_comment(%L, %L, null, true)', tests.id('named'), 'Check lost & found'));
select is((select actor_id::text from public.notifications where user_id = tests.uid('R') and type = 'post.comment'), null,
  'an anonymous comment notifies without saying who');
select is((select comment_count from public.posts where id = tests.id('named')), 1, 'comments are counted');
select is(tests.as('R', format('select count(*)::text from public.comments_public where post_id = %L and author_id is null', tests.id('named'))), '1',
  'anonymous comments hide their author too');

-- reports hold anonymous posts after two
select tests.as('H', format('select public.report(''post'', %L, ''spam'')', tests.id('anon')));
select tests.as('O', format('select public.report(''post'', %L, ''spam'')', tests.id('anon')));
select is((select status from public.posts where id = tests.id('anon')), 'held',
  'two reports hold an anonymous post for moderators');
select is(tests.as('H', format('select count(*)::text from public.posts_public where id = %L', tests.id('anon'))), '0',
  'held posts disappear from the feed');

-- =========================== notifications ===========================
select tests.as('H', format('select public.request_connection(%L)', tests.uid('R')));
select is(tests.as('R', $q$ select type from public.my_notifications() where type like 'connect.%' $q$), 'connect.request',
  'a connect request notifies');
select tests.as('R', format('select public.respond_connection(%L, true)', tests.uid('H')));
select is(tests.as('H', $q$ select actor_handle from public.my_notifications() where type = 'connect.accepted' $q$), 'feed_r',
  'and accepting notifies back, with who');
select tests.as('R', 'select public.mark_notifications_read()');
select is(tests.as('R', 'select count(*)::text from public.notifications where read_at is null'), '0',
  'mark all read');
select is(tests.as('H', 'select count(*)::text from public.notifications where user_id <> auth.uid()'), '0',
  'you only ever see your own notifications');

-- =========================== Backup ===========================
-- C1 muted Backup; C2 already had 5 pings today.
insert into public.notification_prefs (user_id, backup) values (tests.uid('C1'), false);
insert into public.notifications (user_id, type) select tests.uid('C2'), 'backup.nearby' from generate_series(1, 5);

insert into ids values ('req', tests.as('R', $q$ select public.create_backup('Need DSA notes for Monday', 'Lecture 7 onwards', 'notes') $q$)::uuid);
select is((select notified_count from public.backup_requests where id = tests.id('req')), 50,
  'fan-out stops at 50 even with more classmates');
select is((select count(*)::int from public.notifications where type = 'backup.nearby' and entity_id = tests.id('req')), 50,
  'exactly 50 notifications');
select is((select count(*)::int from public.notifications where type = 'backup.nearby' and entity_id = tests.id('req') and user_id = tests.uid('H')), 1,
  'the same section is notified first');
select is((select count(*)::int from public.notifications where entity_id = tests.id('req') and user_id in (tests.uid('C1'), tests.uid('C2'), tests.uid('O'))), 0,
  'muted, already-pinged-5-times and other departments are skipped');

select is(tests.as('H', $q$ select title from public.backup_feed() $q$), 'Need DSA notes for Monday',
  'the request shows in Open near you');
insert into ids values ('conv', tests.as('H', format('select public.claim_backup(%L)', tests.id('req')))::uuid);
select is((select status::text || ',' || (claimed_by = tests.uid('H'))::text from public.backup_requests where id = tests.id('req')),
  'claimed,true', 'H claims it');
select is((select count(*)::int from public.conversation_members where conversation_id = tests.id('conv')), 2,
  'claiming opens a chat between the two');
select throws_ok(format('select tests.as(%L, %L)', 'O', format('select public.claim_backup(%L)', tests.id('req'))),
  '22023', null, 'it cannot be claimed twice');
select tests.as('R', format('select public.resolve_backup(%L)', tests.id('req')));
select is((select points || ',' || helped_count from public.backup_points where user_id = tests.uid('H')), '10,1',
  'resolving gives the helper 10 points');
select ok((select expires_at between now() + interval '71 hours' and now() + interval '73 hours'
           from public.conversations where id = tests.id('conv')),
  'the chat ends 72 hours after it''s resolved');

select * from finish();
rollback;
