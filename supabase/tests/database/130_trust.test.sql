-- Phase 9: every admin and moderator action is audited; moderators act only in their
-- spaces; a deletion request removes PII after the 14-day grace (time travel); badges.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('Mod'), ('S'), ('T'), ('Gone');
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
create function tests.audits(p_action text) returns int language sql stable as $$
  select count(*)::int from public.audit_log where action = p_action;
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-trust@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  role = case when u.name = 'Admin' then 'admin' else 'student' end::public.user_role
from tests.u u where p.id = u.id;
update public.private_profile set personal_email = 'gone-private@example.com', roll_no = 'BSCS51F24R001'
where user_id = tests.uid('Gone');

-- Two posts: one on the campus feed, one in another department's feed.
create temp table post_ids (name text, id uuid);
grant select on post_ids to authenticated;
with p as (
  insert into public.posts (university_id, author_id, space, body)
  select (select university_id from public.departments where short_code = 'CS'), tests.uid('S'), 'campus', 'campus post'
  returning id
) insert into post_ids select 'campus', id from p;
with p as (
  insert into public.posts (university_id, author_id, space, body)
  select (select university_id from public.departments where short_code = 'CS'), tests.uid('S'),
         'department:' || (select id from public.departments where short_code <> 'CS' order by short_code limit 1),
         'other department post'
  returning id
) insert into post_ids select 'dept', id from p;
insert into public.reports (reporter_id, target_type, target_id, reason)
select tests.uid('T'), 'post', id, 'harassment' from post_ids;

-- ---------- moderators ----------
select throws_ok($$ select tests.as('S', format('select public.set_moderator(%L, array[''campus''])', tests.uid('Mod'))) $$,
  '42501', null, 'students can''t appoint moderators');
select lives_ok($$ select tests.as('Admin', format('select public.set_moderator(%L, array[''campus''])', tests.uid('Mod'))) $$,
  'an admin makes someone a campus moderator');
select is((select role::text from public.profiles where id = tests.uid('Mod')), 'moderator', '…which sets their role');
select is(tests.audits('moderator.set'), 1, '…and is audited');
select is(tests.as('Mod', 'select count(*)::text from public.moderation_queue()'), '1',
  'a moderator''s queue shows only reports in their spaces');
select throws_ok($$ select tests.as('Mod', format('select public.moderate_content(''post'', %L, ''hide'')',
  (select id from post_ids where name = 'dept'))) $$,
  '42501', null, 'a moderator can''t act outside their spaces');
select lives_ok($$ select tests.as('Mod', format('select public.moderate_content(''post'', %L, ''hide'', ''Harassment'')',
  (select id from post_ids where name = 'campus'))) $$,
  'a moderator hides a reported post in their space');
select is((select status from public.posts where id = (select id from post_ids where name = 'campus')), 'removed',
  '…the post is removed');
select is((select status::text from public.reports where target_id = (select id from post_ids where name = 'campus')),
  'actioned', '…its reports are resolved');
select is(tests.audits('content.hide'), 1, '…and the action is audited');
select lives_ok($$ select tests.as('Admin', format('select public.dismiss_reports(''post'', %L)',
  (select id from post_ids where name = 'dept'))) $$, 'an admin dismisses reports anywhere');
select is(tests.audits('reports.dismiss'), 1, '…audited');

-- ---------- people, flags and catalogue ----------
select throws_ok($$ select tests.as('Mod', format('select public.ban_user(%L, ''spam'')', tests.uid('T'))) $$,
  '42501', null, 'only admins ban');
do $$
begin
  perform tests.as('Mod', format('select public.warn_user(%L, ''Please keep it civil'')', tests.uid('T')));
  perform tests.as('Admin', format('select public.ban_user(%L, ''Repeated harassment'')', tests.uid('T')));
  perform tests.as('Admin', format('select public.unban_user(%L)', tests.uid('T')));
  perform tests.as('Admin', 'select public.set_flag(''anonymous_posts'', true)');
  perform tests.as('Admin', format('select public.save_department(%L, ''Computer Science'', ''CS'', null, array[''CS & IT''])',
    (select id from public.departments where short_code = 'CS')));
end $$;
select is(tests.audits('user.warn') || ',' || tests.audits('user.ban') || ',' || tests.audits('user.unban') || ','
          || tests.audits('flag.set') || ',' || tests.audits('catalogue.department'),
  '1,1,1,1,1', 'warning, banning, unbanning, flags and catalogue edits are all audited');
select is((select count(*)::text from public.notifications where user_id = tests.uid('T') and type = 'account.warning'),
  '1', 'a warned student is told');

-- ---------- account deletion: 14-day grace, then PII is gone ----------
select lives_ok($$ select tests.as('Gone', 'select public.request_account_deletion()') $$,
  'a student asks to delete their account');
select is(tests.as('S', format('select count(*)::text from public.profiles_public where id = %L', tests.uid('Gone'))),
  '0', 'during the grace period they''re hidden from everyone');
select is(public.purge_deleted_accounts(), 0, 'nothing is purged before 14 days');
-- Time travel: the request was made 15 days ago.
update public.profiles set deleted_at = now() - interval '15 days' where id = tests.uid('Gone');
select is(public.purge_deleted_accounts(), 1, 'after 14 days the account is purged');
select is((select count(*)::int from auth.users where id = tests.uid('Gone'))
          + (select count(*)::int from public.profiles where id = tests.uid('Gone'))
          + (select count(*)::int from public.private_profile where user_id = tests.uid('Gone'))
          + (select count(*)::int from public.private_profile where personal_email = 'gone-private@example.com'),
  0, 'their login, profile and private details (email, roll number) are gone');

-- ---------- badges ----------
insert into public.mentorships (mentor_id, mentee_id, status) values (tests.uid('S'), tests.uid('T'), 'accepted');
do $$ begin perform public.award_badges(); end $$;
select is(tests.as('T', format('select string_agg(slug, '','') from public.profile_badges(%L)', tests.uid('S'))),
  'mentor', 'badges are awarded by the job and shown on profiles');

select * from finish();
rollback;
