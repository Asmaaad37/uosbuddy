-- Document retention: which proof files are due for deletion.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temp table u (name text primary key, id uuid);
insert into u
select n, gen_random_uuid() from unnest(array['pending', 'old', 'recent', 'orphan', 'fresh']) n;
insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, name || '@example.com', now(), 'authenticated', 'authenticated' from u;

-- Files: everything 40 days old except "fresh".
insert into storage.objects (bucket_id, name, created_at)
select 'verification-docs', id::text || '/doc.jpg',
       case when name = 'fresh' then now() - interval '2 days' else now() - interval '40 days' end
from u;

insert into public.verification_requests
  (user_id, university_id, status, doc_path, decided_at)
select u.id, (select id from public.universities where slug = 'uos'), s.status::public.verification_status,
       u.id::text || '/doc.jpg', s.decided_at
from u
join (values
  ('pending', 'pending', null::timestamptz),
  ('old', 'verified', now() - interval '35 days'),
  ('recent', 'rejected', now() - interval '5 days')
) as s(name, status, decided_at) on s.name = u.name;

create temp table due as
select * from public.expired_verification_documents(30, 1000) as name
where split_part(name, '/', 1) in (select id::text from u);

select ok(exists(select 1 from due where name like (select id from u where name = 'old')::text || '/%'),
  'a document decided over 30 days ago is due');
select ok(exists(select 1 from due where name like (select id from u where name = 'orphan')::text || '/%'),
  'an old upload no request points to is due');
select ok(not exists(select 1 from due where name like (select id from u where name = 'pending')::text || '/%'),
  'a document under review is kept, however old');
select ok(not exists(select 1 from due where name like (select id from u where name = 'recent')::text || '/%'),
  'a document decided less than 30 days ago is kept');
select ok(not exists(select 1 from due where name like (select id from u where name = 'fresh')::text || '/%'),
  'a recent upload is kept');

set local role authenticated;
select throws_ok($$ select public.expired_verification_documents() $$, '42501', null,
  'students cannot list documents due for deletion');
reset role;
set local role anon;
select throws_ok($$ select public.expired_verification_documents() $$, '42501', null,
  'visitors cannot list documents due for deletion');
reset role;

select * from finish();
rollback;
