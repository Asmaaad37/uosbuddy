-- Phase 2 task 8: linking a UoS email later. F is a verified fresher, G another verified
-- fresher, P a fresher still pending review.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('F'), ('G'), ('P');

create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-link@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'P' then 'pending' else 'verified' end::public.verification_status,
  verification_method = 'document'
from tests.u u where p.id = u.id;

-- Students can't reach the claims or the functions themselves.
select is(has_function_privilege('authenticated', 'public.start_uni_email_claim(uuid, text, text)', 'execute'),
  false, 'students cannot call start_uni_email_claim');
select is(has_function_privilege('authenticated', 'public.confirm_uni_email_claim(uuid, text)', 'execute'),
  false, 'students cannot call confirm_uni_email_claim');
select is(has_table_privilege('authenticated', 'public.uni_email_claims', 'select'),
  false, 'students cannot read claims');

-- Starting a claim
select is(public.start_uni_email_claim(tests.uid('P'), 'p@uos.edu.pk', 'h'),
  'not_verified', 'a pending fresher cannot link an email yet');
select is(public.start_uni_email_claim(tests.uid('F'), 'f@gmail.com', 'h'),
  'wrong_domain', 'only the university domain is accepted');
select is(public.start_uni_email_claim(tests.uid('F'), 'not-an-email', 'h'),
  'wrong_domain', 'a malformed address is rejected');
select is(public.start_uni_email_claim(tests.uid('F'), 'g-link@example.com', 'h'),
  'wrong_domain', 'another account''s login email is not a uni email');
select is(public.start_uni_email_claim(tests.uid('F'), ' F.Student@UOS.edu.pk ', 'hash-1'),
  'ok', 'a uni email starts a claim, case and spaces ignored');
select is((select email::text from public.uni_email_claims where user_id = tests.uid('F')),
  'f.student@uos.edu.pk', 'the claim stores the address lowercased');

-- Confirming
select is(public.confirm_uni_email_claim(tests.uid('G'), 'hash-1'), 'no_claim', 'no claim, nothing to confirm');
select is(public.confirm_uni_email_claim(tests.uid('F'), 'nope'), 'wrong', 'a wrong code is refused');
select is((select attempts from public.uni_email_claims where user_id = tests.uid('F')), 1,
  'wrong codes are counted');
select is(public.confirm_uni_email_claim(tests.uid('F'), 'hash-1'), 'ok', 'the right code links the email');
select is((select uni_email::text from public.private_profile where user_id = tests.uid('F')),
  'f.student@uos.edu.pk', 'the uni email is on file');
select is((select count(*)::int from public.uni_email_claims where user_id = tests.uid('F')), 0,
  'the claim is gone once used');
select is((select verification_method::text from public.profiles where id = tests.uid('F')), 'document',
  'how the student was verified is unchanged');

-- After linking
select is(public.start_uni_email_claim(tests.uid('F'), 'other@uos.edu.pk', 'h'),
  'already_linked', 'a second uni email cannot be linked');
select is(public.start_uni_email_claim(tests.uid('G'), 'F.STUDENT@uos.edu.pk', 'h'),
  'taken', 'an address someone already linked is taken');

-- Too many tries and expiry
select public.start_uni_email_claim(tests.uid('G'), 'g@uos.edu.pk', 'right');
update public.uni_email_claims set attempts = 5 where user_id = tests.uid('G');
select is(public.confirm_uni_email_claim(tests.uid('G'), 'right'), 'too_many',
  'after five wrong tries even the right code is refused');

select public.start_uni_email_claim(tests.uid('G'), 'g@uos.edu.pk', 'right');
update public.uni_email_claims set expires_at = now() - interval '1 second' where user_id = tests.uid('G');
select is(public.confirm_uni_email_claim(tests.uid('G'), 'right'), 'expired', 'an expired code is refused');

-- The UOS EMAIL stamp follows the linked email.
update public.privacy_settings set profile_visibility = 'everyone' where user_id = tests.uid('F');
select set_config('request.jwt.claims',
  json_build_object('sub', tests.uid('G'), 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select has_uni_email from public.profiles_public where id = tests.uid('F')), true,
  'a linked email shows the UOS EMAIL stamp to others');
reset role;

select * from finish();
rollback;
