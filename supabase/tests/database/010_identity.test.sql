-- Phase 1 identity and verification: sign-up trigger, RLS, protected columns, RPCs, storage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- ---------- helpers (rolled back with the transaction) ----------
create schema tests;

create function tests.create_user(p_email text, p_confirmed boolean default true) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data, raw_app_meta_data)
  values (v_id, p_email, case when p_confirmed then now() end, 'authenticated', 'authenticated',
          '{"full_name":"Test User"}', '{"provider":"email"}');
  return v_id;
end $$;

create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- sign-up ----------
create temp table u (name text primary key, id uuid);
grant select on u to authenticated, anon;
insert into u values
  ('uni',      tests.create_user('ayesha@uos.edu.pk')),
  ('fresher',  tests.create_user('bilal@gmail.com')),
  ('other',    tests.create_user('sana@gmail.com')),
  ('admin',    tests.create_user('admin@gmail.com')),
  ('otp',      tests.create_user('hamza@UOS.edu.pk', false));

select is((select verification_status::text from public.profiles where id = (select id from u where name = 'uni')),
  'verified', 'confirmed uni email is verified at sign-up');
select is((select verification_method::text from public.profiles where id = (select id from u where name = 'uni')),
  'uni_email', 'verification method is uni_email');
select is((select uni_email::text from public.private_profile where user_id = (select id from u where name = 'uni')),
  'ayesha@uos.edu.pk', 'uni email is stored privately');
select is((select verification_status::text from public.profiles where id = (select id from u where name = 'fresher')),
  'unverified', 'personal email stays unverified');
select is((select personal_email::text from public.private_profile where user_id = (select id from u where name = 'fresher')),
  'bilal@gmail.com', 'personal email is stored privately');
select ok(exists(select 1 from public.privacy_settings where user_id = (select id from u where name = 'fresher')),
  'privacy settings row is created');
select is((select full_name from public.profiles where id = (select id from u where name = 'fresher')),
  'Test User', 'full name comes from sign-up metadata');
select ok((select university_id is not null from public.profiles where id = (select id from u where name = 'fresher')),
  'profile is attached to UoS');

select is((select verification_status::text from public.profiles where id = (select id from u where name = 'otp')),
  'unverified', 'unconfirmed uni email is not verified yet');
update auth.users set email_confirmed_at = now() where id = (select id from u where name = 'otp');
select is((select verification_status::text from public.profiles where id = (select id from u where name = 'otp')),
  'verified', 'uni email is verified once confirmed (OTP), case-insensitively');
select is((select personal_email from public.private_profile where user_id = (select id from u where name = 'otp')),
  null, 'a confirmed uni email is not kept as the personal email');

update public.profiles set role = 'admin' where id = (select id from u where name = 'admin');

-- ---------- RLS: who can read what ----------
select tests.login_as((select id from u where name = 'fresher'));
select is((select count(*)::int from public.profiles), 1, 'an unverified user sees only their own profile');
select is((select count(*)::int from public.private_profile), 1, 'an unverified user sees only their own private profile');
select ok((select count(*) from public.departments) > 40, 'the catalogue is readable');

select tests.login_as((select id from u where name = 'uni'));
select ok(exists(select 1 from public.profiles where id = (select id from u where name = 'otp')),
  'a verified user sees other verified students');
select ok(not exists(select 1 from public.profiles where id = (select id from u where name = 'fresher')),
  'a verified user does not see unverified accounts');
select is((select count(*)::int from public.private_profile), 1, 'a verified user cannot read others'' PII');

-- ---------- protected columns ----------
select tests.login_as((select id from u where name = 'fresher'));
select throws_ok($$ update public.profiles set verification_status = 'verified' where id = auth.uid() $$,
  '42501', null, 'an unverified user cannot mark themselves verified');
select tests.login_as((select id from u where name = 'uni'));
select throws_ok($$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'a user cannot make themselves admin');
select lives_ok($$ update public.profiles set bio = 'Chai and C++' where id = auth.uid() $$,
  'a user can edit their own bio');

-- ---------- document verification ----------
select tests.logout();
insert into storage.objects (bucket_id, name)
values ('verification-docs', (select id from u where name = 'fresher')::text || '/card.jpg'),
       ('verification-docs', (select id from u where name = 'other')::text || '/card.jpg');

select tests.login_as((select id from u where name = 'fresher'));
select throws_ok(format($$ select public.submit_verification('Bilal Ahmed', 'NOT-A-ROLL', %L) $$,
    (select id from u where name = 'fresher')::text || '/card.jpg'),
  '22023', null, 'an invalid roll number is rejected');
select throws_ok(format($$ select public.submit_verification('Bilal Ahmed', 'BSCS51F22S037', %L) $$,
    (select id from u where name = 'other')::text || '/card.jpg'),
  '22023', null, 'a user cannot submit someone else''s document');
select lives_ok(format($$ select public.submit_verification('Bilal Ahmed', 'bscs51f22s037', %L, '+92 300 1234567') $$,
    (select id from u where name = 'fresher')::text || '/card.jpg'),
  'a valid submission is accepted');
select is((select verification_status::text from public.profiles where id = auth.uid()),
  'pending', 'the submitter becomes pending');
select is((select roll_no from public.private_profile where user_id = auth.uid()),
  'BSCS51F22S037', 'the roll number is normalised and stored privately');
select lives_ok(format($$ select public.submit_verification('Bilal Ahmed', '22F-US-CSC-401', %L) $$,
    (select id from u where name = 'fresher')::text || '/card.jpg'),
  'resubmitting with a registration number updates the open request');
select is((select count(*)::int from public.verification_requests where user_id = auth.uid()),
  1, 'there is still only one open request');
select throws_ok(format($$ select public.decide_verification(%L, 'verified') $$,
    (select id from public.verification_requests where user_id = auth.uid())),
  '42501', null, 'a student cannot approve their own request');
select is((select count(*)::int from storage.objects where bucket_id = 'verification-docs'),
  0, 'a student cannot read verification documents, not even their own');

select tests.login_as((select id from u where name = 'admin'));
select is((select count(*)::int from storage.objects where bucket_id = 'verification-docs'
            and split_part(name, '/', 1) in (select id::text from u)),
  2, 'an admin can read verification documents');
select lives_ok(format($$ select public.decide_verification(%L, 'verified') $$,
    (select id from public.verification_requests where user_id = (select id from u where name = 'fresher'))),
  'an admin can approve a request');
select is((select verification_status::text || '/' || verification_method::text from public.profiles
           where id = (select id from u where name = 'fresher')),
  'verified/document', 'approval verifies the student by document');
select is((select count(*)::int from public.audit_log where action = 'verification.verified'
            and target_id = (select id from public.verification_requests
                             where user_id = (select id from u where name = 'fresher'))),
  1, 'the decision is written to the audit log');

select * from finish();
rollback;
