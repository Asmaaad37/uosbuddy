-- Nobody can work out who wrote an anonymous post. W writes, V reads and tries to unmask them,
-- Mod moderates the campus feed, Admin may reveal an author on the record.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('W'), ('V'), ('Mod'), ('Admin');
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
select id, lower(name) || '-anon@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Anon ' || u.name, handle = 'anon_' || lower(u.name), guidelines_accepted_at = now(),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;
update public.feature_flags set enabled = true where key = 'anonymous_posts';

create table tests.ids (name text primary key, id uuid);
grant select on tests.ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
create function tests.post(p_who text, p_space text, p_body text, p_anon boolean) returns uuid language sql as $$
  select tests.as(p_who, format('select public.create_post(%L, %L, ''{}'', null, %L)', p_space, p_body, p_anon))::uuid;
$$;
create function tests.comment(p_who text, p_post uuid, p_body text, p_anon boolean) returns uuid language sql as $$
  select tests.as(p_who, format('select public.create_comment(%L, %L, null, %L)', p_post, p_body, p_anon))::uuid;
$$;
-- A named post in the department feed, which Mod doesn't moderate.
insert into tests.ids values ('anon', tests.post('W', 'campus', 'Secret post', true));
insert into tests.ids select 'named', tests.post('W', 'department:' || department_id, 'Named post', false)
  from public.profiles where id = tests.uid('W');
insert into tests.ids select 'vpost', tests.post('V', 'department:' || department_id, 'V post', false)
  from public.profiles where id = tests.uid('V');
insert into tests.ids values ('own_named', tests.comment('W', tests.id('anon'), 'My own comment', false));
insert into tests.ids values ('anon_on_named', tests.comment('W', tests.id('named'), 'Anonymous on my named post', true));
insert into tests.ids values ('v_comment', tests.comment('V', tests.id('anon'), 'V comment', false));
insert into tests.ids values ('w_named', tests.comment('W', tests.id('vpost'), 'W named comment', false));

create function tests.c(p_col text, p_id uuid) returns text language sql as $$
  select tests.as('V', format('select %s from public.comments_public where id = %L', p_col, p_id));
$$;
create function tests.posts(p_id uuid) returns text language sql as $$
  select tests.as('V', format('select count(*)::text from public.posts_public where id = %L', p_id));
$$;

select is(tests.posts(tests.id('anon')), '1', 'V sees the anonymous post');

-- ---------- OP badge ----------
select is(tests.c('coalesce(author_id::text, ''null'') || '','' || is_anonymous', tests.id('own_named')), 'null,true',
  'your comment on your own anonymous post is anonymous, even if you asked otherwise');
select is(tests.c('is_op::text', tests.id('own_named')), 'true', 'and shows OP');
select is(tests.c('is_op::text', tests.id('anon_on_named')), 'false',
  'an anonymous comment on your own named post has no OP, which would tie it to you');
select is(tests.c('is_op::text', tests.id('v_comment')), 'false', 'nor does someone else''s comment');

-- ---------- blocking can't unmask ----------
select lives_ok(format('select tests.as(''V'', %L)', format('select ''done'' from public.block_user(%L)', tests.uid('W'))),
  'V blocks W');
select is(tests.posts(tests.id('named')), '0', 'W''s named posts disappear for V');
select is(tests.posts(tests.id('anon')), '1', 'their anonymous post doesn''t, or it would name them');
select is(tests.as('V', $q$ select count(*)::text from public.feed_page('campus', 'new') where body = 'Secret post' $q$), '1',
  'nor from the feed');
select is(tests.c('count(*)::text', tests.id('own_named')), '1', 'nor do anonymous comments');
select is(tests.c('count(*)::text', tests.id('w_named')), '0', 'named comments do');

-- ---------- moderators ----------
select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.set_moderator(%L, array[''campus''])', tests.uid('Mod'))),
  'Mod moderates the campus feed');
select is(tests.as('Mod', 'select count(*)::text from public.posts'), '0', 'moderators can''t read the posts table');
select is(tests.as('Mod', 'select count(*)::text from public.comments'), '0', 'or comments');
select is(tests.as('Admin', 'select count(*)::text from public.posts'), '0', 'nor can admins, without going through Reveal');
select lives_ok(format('select tests.as(''V'', %L)', format('select ''done'' from public.report(''post'', %L, ''spam'')', tests.id('anon'))),
  'V reports the anonymous post');
select is(tests.as('Mod', format('select count(*)::text from public.moderation_queue() where target_id = %L', tests.id('anon'))), '1',
  'it reaches the moderator');
select is(tests.as('Mod', format($q$ select coalesce(author_id::text, 'null') || coalesce(author_name, 'null') || coalesce(author_handle, 'null')
  from public.moderation_queue() where target_id = %L $q$, tests.id('anon'))), 'nullnullnull', 'without saying who wrote it');
select throws_ok(format('select tests.as(''Mod'', %L)', format('select ''done'' from public.warn_user(%L, ''Please be civil'')', tests.uid('W'))),
  '42501', null, 'a moderator can''t test a guess by warning someone who only posted anonymously');

-- ---------- admins reveal, on the record ----------
select is(tests.as('Admin', format($q$ select coalesce(author_id::text, 'null') from public.moderation_queue() where target_id = %L $q$, tests.id('anon'))), 'null',
  'admins don''t see it by default');
select throws_ok(format('select tests.as(''V'', %L)', format('select id::text from public.reveal_anonymous_author(''post'', %L)', tests.id('anon'))),
  '42501', null, 'students can''t reveal');
select throws_ok(format('select tests.as(''Mod'', %L)', format('select id::text from public.reveal_anonymous_author(''post'', %L)', tests.id('anon'))),
  '42501', null, 'moderators can''t reveal');
select is(tests.as('Admin', format('select id::text from public.reveal_anonymous_author(''post'', %L)', tests.id('anon'))), tests.uid('W')::text,
  'an admin can');
select is((select count(*)::int from public.audit_log where action = 'content.reveal_author' and target_id = tests.id('anon')
           and actor_id = tests.uid('Admin')), 1, 'and it''s on record');
select throws_ok(format('select tests.as(''Admin'', %L)', format('select id::text from public.reveal_anonymous_author(''post'', %L)', tests.id('named'))),
  '22023', null, 'only anonymous items can be revealed');
select is(has_function_privilege('authenticated', 'public.alias_for(uuid, uuid)', 'execute'), false,
  'nobody can compare aliases to test a guess');

-- ---------- bans still apply ----------
update public.profiles set banned_at = now() where id = tests.uid('W');
select is(tests.posts(tests.id('anon')), '0', 'a banned student''s anonymous post is hidden');

select * from finish();
rollback;
