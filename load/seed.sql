-- Phase 10 load test seed (BUILD_PLAN §4.12): 500 verified students in one group chat,
-- and 2,000 campus posts. For a local or staging stack only; never production.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f load/seed.sql
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select gen_random_uuid(), 'load-' || g || '@example.com', now(), 'authenticated', 'authenticated'
from generate_series(1, 500) g;

create temp table load_people as
select p.id, row_number() over (order by p.id)::int as n
from public.profiles p join auth.users u on u.id = p.id
where u.email like 'load-%@example.com';

update public.profiles p set
  verification_status = 'verified', verification_method = 'document', verified_at = now(),
  onboarding_step = 4, guidelines_accepted_at = now(),
  university_id = (select university_id from public.departments order by short_code limit 1),
  department_id = (select id from public.departments order by short_code offset (lp.n % 10) limit 1),
  full_name = 'Load Student ' || lp.n, handle = 'load_' || lp.n, batch_year = 2021 + lp.n % 5
from load_people lp where p.id = lp.id;

-- One busy group chat everyone is in.
insert into public.conversations (id, kind, university_id, title, created_by)
select '00000000-0000-0000-0000-00000000c0de', 'group',
       (select university_id from public.departments order by short_code limit 1), 'Load test',
       (select id from load_people where n = 1);
insert into public.conversation_members (conversation_id, user_id, accepted_at)
select '00000000-0000-0000-0000-00000000c0de', id, now() from load_people;

-- A realistic feed: 2,000 posts over the last two weeks, with votes.
insert into public.posts (university_id, author_id, space, body, created_at, upvotes)
select (select university_id from public.departments order by short_code limit 1),
       (select id from load_people where n = 1 + (g % 500)),
       'campus', 'Load test post ' || g || ': anyone know when the library closes?',
       now() - (g * interval '10 minutes'), (g * 7) % 50
from generate_series(1, 2000) g;

commit;
analyze public.posts;
analyze public.messages;
analyze public.profiles;
select count(*) as students from load_people;
