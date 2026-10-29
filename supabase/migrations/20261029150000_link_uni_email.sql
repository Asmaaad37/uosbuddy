-- Phase 2 task 8: a student verified some other way (a fresher's proof) links their UoS
-- email later and earns the UOS EMAIL stamp. The app emails a 6-digit code over SMTP;
-- these functions hold the rules. Only the server (service_role) may call them, with the
-- caller's user id taken from their session, so a student can never read or skip the code.

create table public.uni_email_claims (
  user_id uuid primary key references public.profiles on delete cascade,
  email extensions.citext not null,
  -- sha256 of "{user_id}:{code}", computed by the app. The plain code is never stored.
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.uni_email_claims enable row level security;
-- No policies: students never touch this table directly.
revoke all on public.uni_email_claims from anon, authenticated;
grant all on public.uni_email_claims to service_role;

-- Starts (or restarts) a claim. Returns 'ok', 'not_verified', 'already_linked',
-- 'wrong_domain' or 'taken'.
create or replace function public.start_uni_email_claim(
  p_user uuid,
  p_email text,
  p_code_hash text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.profiles
    where id = p_user and verification_status = 'verified' and banned_at is null
  ) then
    return 'not_verified';
  end if;
  if exists (select 1 from public.private_profile where user_id = p_user and uni_email is not null) then
    return 'already_linked';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' or not exists (
    select 1 from public.university_domains d
    join public.profiles p on p.university_id = d.university_id
    where p.id = p_user and lower(d.domain::text) = split_part(v_email, '@', 2)
  ) then
    return 'wrong_domain';
  end if;
  if exists (
    select 1 from public.private_profile
    where lower(uni_email::text) = v_email and user_id <> p_user
  ) or exists (
    select 1 from auth.users where lower(email) = v_email and id <> p_user
  ) then
    return 'taken';
  end if;

  insert into public.uni_email_claims (user_id, email, code_hash, expires_at)
  values (p_user, v_email, p_code_hash, now() + interval '10 minutes')
  on conflict (user_id) do update
    set email = excluded.email, code_hash = excluded.code_hash,
        expires_at = excluded.expires_at, attempts = 0, created_at = now();
  return 'ok';
end;
$$;

-- Checks a code. Returns 'ok', 'no_claim', 'expired', 'too_many', 'wrong' or 'taken'.
-- Five wrong tries end the claim; the student asks for a new code.
create or replace function public.confirm_uni_email_claim(
  p_user uuid,
  p_code_hash text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.uni_email_claims;
begin
  select * into v_claim from public.uni_email_claims where user_id = p_user for update;
  if not found then
    return 'no_claim';
  end if;
  if v_claim.expires_at < now() then
    delete from public.uni_email_claims where user_id = p_user;
    return 'expired';
  end if;
  if v_claim.attempts >= 5 then
    delete from public.uni_email_claims where user_id = p_user;
    return 'too_many';
  end if;
  if v_claim.code_hash <> p_code_hash then
    update public.uni_email_claims set attempts = attempts + 1 where user_id = p_user;
    return 'wrong';
  end if;

  -- Someone may have taken the address while the code was in flight.
  if exists (
    select 1 from public.private_profile
    where lower(uni_email::text) = lower(v_claim.email::text) and user_id <> p_user
  ) then
    delete from public.uni_email_claims where user_id = p_user;
    return 'taken';
  end if;

  update public.private_profile set uni_email = v_claim.email where user_id = p_user;
  delete from public.uni_email_claims where user_id = p_user;
  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (p_user, 'link_uni_email', 'profile', p_user, jsonb_build_object('email', v_claim.email));
  return 'ok';
end;
$$;

revoke execute on function public.start_uni_email_claim(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_uni_email_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.start_uni_email_claim(uuid, text, text) to service_role;
grant execute on function public.confirm_uni_email_claim(uuid, text) to service_role;

-- The stamp now means "has a UoS email on file", however the student was verified.
create or replace view public.profiles_public with (security_barrier = true) as
select
  p.id,
  p.university_id,
  p.handle,
  p.full_name,
  case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end
    as avatar_url,
  p.department_id,
  p.program_id,
  p.batch_year,
  p.semester,
  p.section,
  p.shift,
  p.residence,
  case when s.show_hometown or p.id = auth.uid() then p.hometown_city end as hometown_city,
  p.bio,
  p.opening_move_prompt,
  p.opening_move,
  p.pronoun_display,
  p.is_mentor,
  pp.uni_email is not null as has_uni_email,
  p.verified_at
from public.profiles p
join public.privacy_settings s on s.user_id = p.id
left join public.private_profile pp on pp.user_id = p.id
where public.visible_at(p.id, s.profile_visibility);
