-- Uploads have a daily quota, and files nothing uses any more are found for deletion.
-- S is a verified student; the files below are storage rows only (the Storage API isn't here).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('S'), ('Gone');
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
select id, lower(name) || '-files@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Files ' || u.name, handle = 'files_' || lower(u.name)
from tests.u u where p.id = u.id;

-- ---------- quota ----------
select is(tests.as('S', 'select public.under_upload_quota()::text'), 'true', 'a new student can upload');
insert into storage.objects (bucket_id, name, owner_id)
select 'post-media', 'posts/' || gen_random_uuid() || '.webp', tests.uid('S')::text from generate_series(1, 59);
select is(tests.as('S', 'select public.under_upload_quota()::text'), 'true', 'still under 60 files today');
insert into storage.objects (bucket_id, name, owner_id)
values ('chat-attachments', gen_random_uuid() || '/x.webp', tests.uid('S')::text);
select is(tests.as('S', 'select public.under_upload_quota()::text'), 'false', 'the 60th file uses up the day');
update storage.objects set created_at = now() - interval '25 hours' where owner_id = tests.uid('S')::text;
select is(tests.as('S', 'select public.under_upload_quota()::text'), 'true', 'and a day later there''s room again');
select ok((select count(*) = 4 from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and cmd = 'INSERT' and with_check like '%under_upload_quota%'), 'all four upload rules check it');

-- ---------- clean-up ----------
create table tests.f (name text primary key, bucket text, path text);
insert into tests.f values
  ('live_post',    'post-media', 'posts/00000000-0000-0000-0000-0000000000a1.webp'),
  ('removed_post', 'post-media', 'posts/00000000-0000-0000-0000-0000000000a2.webp'),
  ('loose_post',   'post-media', 'posts/00000000-0000-0000-0000-0000000000a3.webp'),
  ('fresh_loose',  'post-media', 'posts/00000000-0000-0000-0000-0000000000a4.webp'),
  ('chat_kept',    'chat-attachments', '00000000-0000-0000-0000-0000000000c1/kept.webp'),
  ('chat_deleted', 'chat-attachments', '00000000-0000-0000-0000-0000000000c1/gone.webp'),
  ('avatar_kept',  'avatars', tests.uid('S') || '/1-512.webp'),
  ('avatar_gone',  'avatars', gen_random_uuid() || '/1-512.webp'),
  ('doc',          'verification-docs', tests.uid('S') || '/card.jpg');
insert into storage.objects (bucket_id, name, owner_id, created_at)
select bucket, path, tests.uid('S')::text,
       case when name = 'fresh_loose' then now() else now() - interval '2 days' end
from tests.f;
insert into public.posts (university_id, author_id, space, body, media_paths, status)
select university_id, tests.uid('S'), 'campus', 'Live', array[(select path from tests.f where name = 'live_post')], 'published'
from public.profiles where id = tests.uid('S');
insert into public.posts (university_id, author_id, space, body, media_paths, status)
select university_id, tests.uid('S'), 'campus', 'Removed', array[(select path from tests.f where name = 'removed_post')], 'removed'
from public.profiles where id = tests.uid('S');
insert into public.conversations (id, kind, title) values ('00000000-0000-0000-0000-0000000000c1', 'group', 'Files');
insert into public.messages (conversation_id, sender_id, attachment_path)
values ('00000000-0000-0000-0000-0000000000c1', tests.uid('S'), (select path from tests.f where name = 'chat_kept'));

create function tests.due(p_name text) returns boolean language sql as $$
  select exists (select 1 from public.unused_storage_files() u
                 join tests.f f on f.bucket = u.bucket_id and f.path = u.name where f.name = p_name);
$$;
select is(tests.due('live_post'), false, 'a photo on a live post stays');
select is(tests.due('removed_post'), true, 'a removed post''s photo goes');
select is(tests.due('loose_post'), true, 'an upload nothing used goes');
select is(tests.due('fresh_loose'), false, 'but not one from the last day, which may be about to be posted');
select is(tests.due('chat_kept'), false, 'a photo still in a chat stays');
select is(tests.due('chat_deleted'), true, 'a deleted message''s photo goes');
select is(tests.due('avatar_gone') and not tests.due('avatar_kept'), true,
  'a purged account''s avatar goes; a live student''s stays');
select is(has_function_privilege('authenticated', 'public.unused_storage_files(interval, int)', 'execute'), false,
  'students can''t list other people''s files');

select * from finish();
rollback;
