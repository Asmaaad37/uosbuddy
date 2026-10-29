-- Phase 3 discovery: the directory, counts and suggestions never show more than
-- profiles_public would, and honour scope, directory opt-out, blocks and search.
-- T is the target; B same section, S same batch other section, D same department other
-- batch, O another department, U unverified, N not finished with setup.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('T'), ('B'), ('S'), ('D'), ('O'), ('U'), ('N');

create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Whom the viewer finds in a directory scope (optionally searching).
create function tests.found(p_viewer text, p_scope text, p_query text default null)
returns uuid[] language plpgsql as $$
declare v uuid[];
begin
  perform tests.login(tests.uid(p_viewer));
  select coalesce(array_agg(id), '{}') into v from public.directory(p_scope, p_query, p_limit => 50);
  execute 'reset role';
  return v;
end $$;

-- Directory rows the viewer gets that profiles_public would hide (must be none).
create function tests.leaks(p_viewer text) returns int language plpgsql as $$
declare n int;
begin
  perform tests.login(tests.uid(p_viewer));
  select count(*) into n from public.directory('all', p_limit => 50) d
  where not exists (select 1 from public.profiles_public p where p.id = d.id);
  execute 'reset role';
  return n;
end $$;

create function tests.suggested(p_viewer text) returns uuid[] language plpgsql as $$
declare v uuid[];
begin
  perform tests.login(tests.uid(p_viewer));
  select coalesce(array_agg((s.person).id), '{}') into v from public.suggest_people(50) s;
  execute 'reset role';
  return v;
end $$;

grant usage on schema tests to authenticated, anon;
grant select on tests.u to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-disc@example.com', now(), 'authenticated', 'authenticated' from tests.u;

update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  department_id = (select id from public.departments where short_code = case when u.name = 'O' then 'IT' else 'CS' end),
  batch_year = case when u.name = 'D' then 2023 else 2024 end,
  section = case when u.name = 'S' then 'C' else 'B' end,
  shift = 'morning',
  residence = 'hostelite',
  handle = 'disc_' || lower(u.name),
  full_name = 'Disc ' || u.name || ' Person',
  avatar_url = 'https://example.com/' || lower(u.name) || '.webp',
  hometown_city = 'Sargodha',
  onboarding_step = case when u.name = 'N' then 2 else 4 end
from tests.u u where p.id = u.id;
update public.privacy_settings set profile_visibility = 'everyone', photo_visibility = 'everyone'
where user_id in (select id from tests.u);
insert into public.profile_interests (user_id, interest_id)
select tests.uid(n), (select id from public.interests where slug = 'cricket') from unnest(array['T','B']) n;

-- ---------- grants ----------
select is(has_function_privilege('anon', 'public.directory(text, text, public.shift_type, public.residence_type, text, uuid, text, uuid, int)', 'execute'),
  false, 'visitors cannot list the directory');
select is(has_function_privilege('anon', 'public.suggest_people(int, int)', 'execute'),
  false, 'visitors cannot get suggestions');

-- ---------- scopes ----------
select ok(tests.uid('T') = any(tests.found('B', 'section')), 'section: same section finds T');
select ok(not tests.uid('T') = any(tests.found('S', 'section')), 'section: another section does not');
select ok(tests.uid('T') = any(tests.found('S', 'batch')), 'batch: same batch finds T');
select ok(not tests.uid('T') = any(tests.found('D', 'batch')), 'batch: another batch does not');
select ok(tests.uid('T') = any(tests.found('D', 'department')), 'department: same department finds T');
select ok(not tests.uid('T') = any(tests.found('O', 'department')), 'department: another department does not');
select ok(tests.uid('T') = any(tests.found('O', 'all')), 'all: the whole university finds T');
select ok(not tests.uid('B') = any(tests.found('B', 'all')), 'you are not listed to yourself');
select ok(not tests.uid('N') = any(tests.found('B', 'all')), 'students still in setup are not listed');
select is(tests.found('U', 'all'), '{}'::uuid[], 'an unverified account sees nobody');

-- ---------- never more than profiles_public, at every visibility level ----------
select is((select sum(tests.leaks(v))::int from unnest(array['B','S','D','O']) v), 0,
  'everyone: the directory shows nobody profiles_public hides');
update public.privacy_settings set profile_visibility = 'department' where user_id = tests.uid('T');
select ok(not tests.uid('T') = any(tests.found('O', 'all')), 'department: another department cannot list T');
select is((select sum(tests.leaks(v))::int from unnest(array['B','S','D','O']) v), 0,
  'department: no leaks');
update public.privacy_settings set profile_visibility = 'batch' where user_id = tests.uid('T');
select ok(not tests.uid('T') = any(tests.found('D', 'all')), 'batch: another batch cannot list T');
select is((select sum(tests.leaks(v))::int from unnest(array['B','S','D','O']) v), 0,
  'batch: no leaks');
update public.privacy_settings set profile_visibility = 'connections' where user_id = tests.uid('T');
select ok(not tests.uid('T') = any(tests.found('B', 'all')), 'connections: nobody lists T yet');
update public.privacy_settings set profile_visibility = 'nobody' where user_id = tests.uid('T');
select ok(not tests.uid('T') = any(tests.found('B', 'all')), 'nobody: nobody lists T');
select is((select sum(tests.leaks(v))::int from unnest(array['B','S','D','O']) v), 0,
  'nobody: no leaks');
update public.privacy_settings set profile_visibility = 'everyone' where user_id = tests.uid('T');

-- ---------- masks ----------
update public.privacy_settings set photo_visibility = 'batch', show_hometown = false where user_id = tests.uid('T');
select tests.login(tests.uid('D'));
select is((select avatar_url from public.directory('all', p_limit => 50) where id = tests.uid('T')), null,
  'the photo is hidden outside the allowed level');
select is((select hometown_city from public.directory('all', p_limit => 50) where id = tests.uid('T')), null,
  'the hometown is hidden when the student hides it');
select is((select count(*)::int from public.directory('all', p_hometown => 'Sargodha', p_limit => 50) where id = tests.uid('T')), 0,
  'a hidden hometown cannot be found by filtering');
reset role;
update public.privacy_settings set photo_visibility = 'everyone', show_hometown = true where user_id = tests.uid('T');

-- ---------- directory opt-out and search ----------
update public.privacy_settings set show_in_directory = false where user_id = tests.uid('T');
select ok(not tests.uid('T') = any(tests.found('B', 'batch')), 'left the directory: not listed');
select ok(not tests.uid('T') = any(tests.found('B', 'all', 'Disc T')), 'left the directory: not found by name');
select ok(tests.uid('T') = any(tests.found('B', 'all', '@DISC_T')), 'left the directory: still found by exact handle');
update public.privacy_settings set show_in_directory = true where user_id = tests.uid('T');
select ok(tests.uid('T') = any(tests.found('O', 'all', 'disc t pers')), 'search matches part of a name');
select ok(tests.uid('T') = any(tests.found('O', 'all', 'disc_')), 'search matches the start of a handle');
select is(tests.found('O', 'all', '%'), '{}'::uuid[], 'wildcards are searched literally');

-- ---------- blocks ----------
insert into public.blocks (blocker_id, blocked_id) values (tests.uid('T'), tests.uid('B'));
select ok(not tests.uid('T') = any(tests.found('B', 'all')), 'a blocked student cannot list the blocker');
select ok(not tests.uid('B') = any(tests.found('T', 'all')), 'the blocker does not list them either');
select ok(not tests.uid('T') = any(tests.suggested('B')), 'blocked students are not suggested');
delete from public.blocks;

-- ---------- pages, counts, suggestions ----------
select tests.login(tests.uid('B'));
select is(
  (select array_agg(id order by id) from (
     select id from public.directory('all', p_limit => 2)
     union all
     select n.id from (select sort_key, id from public.directory('all', p_limit => 2) offset 1) last,
       lateral public.directory('all', p_after_key => last.sort_key, p_after_id => last.id, p_limit => 50) n) x),
  (select array_agg(id order by id) from public.directory('all', p_limit => 50)),
  'keyset pages join up with no gaps or repeats');
select is((select row(section_count, batch_count, department_count, university_count)::text from public.directory_counts()),
  '(1,2,3,4)', 'counts: section T; batch T,S; department T,S,D; university T,S,D,O');
reset role;
select tests.login(tests.uid('B'));
select is((select reasons from public.suggest_people(50) s where (s.person).id = tests.uid('T')),
  array['Same section', 'Both into Cricket', 'Also from Sargodha', 'Also a hostelite'],
  'suggestions explain themselves, strongest reason first');
reset role;
select ok(tests.suggested('B')[1] = tests.uid('T'), 'the same-section, same-interest student is suggested first');

select * from finish();
rollback;
