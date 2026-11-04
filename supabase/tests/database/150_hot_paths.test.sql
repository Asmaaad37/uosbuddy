-- Phase 10: the faster feed and chat paths show exactly what the old ones did.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-hot@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024
from tests.u u where p.id = u.id;

-- A: three posts; B: one held post; C: one post, but A has blocked C.
insert into public.posts (university_id, author_id, space, body, created_at, hot_score, status)
select (select university_id from public.departments where short_code = 'CS'), tests.uid(w), 'campus', b,
       now() - make_interval(mins => m), h, st
from (values ('A', 'a1', 1, 3.0, 'published'), ('A', 'a2', 2, 2.0, 'published'),
             ('A', 'a3', 3, 1.0, 'published'), ('B', 'b-held', 4, 5.0, 'held'),
             ('C', 'c1', 5, 4.0, 'published')) v(w, b, m, h, st);
insert into public.blocks (blocker_id, blocked_id) values (tests.uid('A'), tests.uid('C'));

select is(tests.as('A', $q$ select string_agg(body, ',' order by hot_score desc) from public.feed_page('campus', 'hot') $q$),
  'a1,a2,a3', 'the hot feed hides others'' held posts and blocked authors, in order');
select is(tests.as('B', $q$ select string_agg(body, ',') from public.feed_page('campus', 'new') $q$),
  'a1,a2,a3,b-held', 'the new feed shows your own held post, newest first');
select is(tests.as('A', $q$ select string_agg(body, ',') from public.feed_page('campus', 'new', null, null, null, 2) $q$),
  'a1,a2', 'a page stops at the limit');
select is(tests.as('A', $q$ select string_agg(body, ',') from public.feed_page('campus', 'new', null,
  (select created_at from public.posts where body = 'a2'), (select id from public.posts where body = 'a2')) $q$),
  'a3', 'the next page continues after the last post, without repeats');
select is(tests.as('A', format($q$ select count(*)::text from public.feed_page('department:%s') $q$,
  (select id from public.departments where short_code <> 'CS' order by short_code limit 1))),
  '0', 'another department''s feed stays closed');

-- Chat: members read messages; others don't.
insert into public.conversations (id, kind, university_id, title)
values ('00000000-0000-0000-0000-0000000000c1', 'group',
        (select university_id from public.departments where short_code = 'CS'), 'Hot path');
insert into public.conversation_members (conversation_id, user_id, accepted_at)
values ('00000000-0000-0000-0000-0000000000c1', tests.uid('A'), now());
do $$ begin
  perform tests.as('A', 'select (public.send_message(''00000000-0000-0000-0000-0000000000c1'', ''hello'')).id::text');
end $$;
select is(tests.as('A', $q$ select count(*)::text from public.messages where conversation_id = '00000000-0000-0000-0000-0000000000c1' $q$),
  '1', 'members read their chat');
select is(tests.as('B', $q$ select count(*)::text from public.messages where conversation_id = '00000000-0000-0000-0000-0000000000c1' $q$),
  '0', 'non-members read nothing');

select * from finish();
rollback;
