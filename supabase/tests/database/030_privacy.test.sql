-- Phase 2 privacy: who sees a profile (can_view_profile matrix), field masks, handles,
-- interests. T is the target; B same batch, D same department, O another department,
-- U unverified.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('T'), ('B'), ('D'), ('O'), ('U');

create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;

-- Runs one query as the given student and switches back.
create function tests.sees(p_viewer uuid, p_target uuid) returns boolean language plpgsql as $$
declare v_seen boolean;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_viewer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select exists(select 1 from public.profiles_public where id = p_target) into v_seen;
  execute 'reset role';
  return v_seen;
end $$;

create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

grant usage on schema tests to authenticated, anon;
grant select on tests.u to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-privacy@example.com', now(), 'authenticated', 'authenticated' from tests.u;

-- Everyone but U is verified; T, B, U in CS 2024, D in CS 2023, O in IT 2024.
update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  department_id = (select id from public.departments where short_code = case when u.name = 'O' then 'IT' else 'CS' end),
  batch_year = case when u.name = 'D' then 2023 else 2024 end,
  handle = 'privacy_' || lower(u.name),
  avatar_url = 'https://example.com/' || lower(u.name) || '.webp',
  hometown_city = 'Sargodha'
from tests.u u where p.id = u.id;

-- ---------- profile visibility matrix (25) ----------
update public.privacy_settings set profile_visibility = 'everyone' where user_id = tests.uid('T');
select is(tests.sees(tests.uid('B'), tests.uid('T')), true, 'everyone: same batch sees the profile');
select is(tests.sees(tests.uid('D'), tests.uid('T')), true, 'everyone: same department, other batch sees the profile');
select is(tests.sees(tests.uid('O'), tests.uid('T')), true, 'everyone: another department sees the profile');
select is(tests.sees(tests.uid('U'), tests.uid('T')), false, 'everyone: an unverified account does not see the profile');
select is(tests.sees(tests.uid('T'), tests.uid('T')), true, 'everyone: the student themselves sees the profile');
update public.privacy_settings set profile_visibility = 'department' where user_id = tests.uid('T');
select is(tests.sees(tests.uid('B'), tests.uid('T')), true, 'department: same batch sees the profile');
select is(tests.sees(tests.uid('D'), tests.uid('T')), true, 'department: same department, other batch sees the profile');
select is(tests.sees(tests.uid('O'), tests.uid('T')), false, 'department: another department does not see the profile');
select is(tests.sees(tests.uid('U'), tests.uid('T')), false, 'department: an unverified account does not see the profile');
select is(tests.sees(tests.uid('T'), tests.uid('T')), true, 'department: the student themselves sees the profile');
update public.privacy_settings set profile_visibility = 'batch' where user_id = tests.uid('T');
select is(tests.sees(tests.uid('B'), tests.uid('T')), true, 'batch: same batch sees the profile');
select is(tests.sees(tests.uid('D'), tests.uid('T')), false, 'batch: same department, other batch does not see the profile');
select is(tests.sees(tests.uid('O'), tests.uid('T')), false, 'batch: another department does not see the profile');
select is(tests.sees(tests.uid('U'), tests.uid('T')), false, 'batch: an unverified account does not see the profile');
select is(tests.sees(tests.uid('T'), tests.uid('T')), true, 'batch: the student themselves sees the profile');
update public.privacy_settings set profile_visibility = 'connections' where user_id = tests.uid('T');
select is(tests.sees(tests.uid('B'), tests.uid('T')), false, 'connections: same batch does not see the profile');
select is(tests.sees(tests.uid('D'), tests.uid('T')), false, 'connections: same department, other batch does not see the profile');
select is(tests.sees(tests.uid('O'), tests.uid('T')), false, 'connections: another department does not see the profile');
select is(tests.sees(tests.uid('U'), tests.uid('T')), false, 'connections: an unverified account does not see the profile');
select is(tests.sees(tests.uid('T'), tests.uid('T')), true, 'connections: the student themselves sees the profile');
update public.privacy_settings set profile_visibility = 'nobody' where user_id = tests.uid('T');
select is(tests.sees(tests.uid('B'), tests.uid('T')), false, 'nobody: same batch does not see the profile');
select is(tests.sees(tests.uid('D'), tests.uid('T')), false, 'nobody: same department, other batch does not see the profile');
select is(tests.sees(tests.uid('O'), tests.uid('T')), false, 'nobody: another department does not see the profile');
select is(tests.sees(tests.uid('U'), tests.uid('T')), false, 'nobody: an unverified account does not see the profile');
select is(tests.sees(tests.uid('T'), tests.uid('T')), true, 'nobody: the student themselves sees the profile');

-- ---------- field masks ----------
update public.privacy_settings
   set profile_visibility = 'everyone', photo_visibility = 'batch', show_hometown = false
 where user_id = tests.uid('T');
select tests.login_as(tests.uid('B'));
select isnt((select avatar_url from public.profiles_public where id = tests.uid('T')), null,
  'a batchmate sees a batch-only photo');
select is((select hometown_city from public.profiles_public where id = tests.uid('T')), null,
  'a hidden hometown is blanked for others');
select is((select count(*)::int from public.profiles where id = tests.uid('T')), 0,
  'other students cannot read the base profiles table');
select tests.login_as(tests.uid('O'));
select is((select avatar_url from public.profiles_public where id = tests.uid('T')), null,
  'another department does not see a batch-only photo');
select tests.login_as(tests.uid('T'));
select is((select hometown_city from public.profiles_public where id = tests.uid('T')), 'Sargodha',
  'students always see their own hometown');

-- ---------- handles ----------
select tests.login_as(tests.uid('B'));
select is(public.handle_available('PRIVACY_T'), false, 'a taken handle is unavailable, case-insensitively');
select is(public.handle_available('privacy_b'), true, 'your own handle counts as available');
select is(public.handle_available('fresh_handle'), true, 'an unused handle is available');
select is(public.handle_available('ab'), false, 'a too-short handle is unavailable');

-- ---------- interests: at most 10 ----------
select tests.login_as(tests.uid('T'));
select lives_ok($$
  insert into public.profile_interests (user_id, interest_id)
  select auth.uid(), id from public.interests order by sort limit 10
$$, 'a student can pick 10 interests');
select throws_ok($$
  insert into public.profile_interests (user_id, interest_id)
  select auth.uid(), id from public.interests order by sort offset 10 limit 1
$$, '22023', null, 'an 11th interest is refused');

-- ---------- academic consistency ----------
select throws_ok($$
  update public.profiles
     set program_id = (select pr.id from public.programs pr join public.departments d on d.id = pr.department_id
                       where d.short_code = 'IT' limit 1)
   where id = auth.uid()
$$, '22023', null, 'a program from another department is refused');

-- ---------- anonymous visitors ----------
reset role;
set local role anon;
select throws_ok($$ select * from public.profiles_public $$, '42501', null,
  'visitors cannot read profiles');
select throws_ok($$ select public.visible_at(gen_random_uuid(), 'everyone') $$, '42501', null,
  'visitors cannot call the visibility check');
reset role;

select * from finish();
rollback;
