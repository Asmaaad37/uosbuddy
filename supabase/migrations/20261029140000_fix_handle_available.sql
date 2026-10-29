-- With search_path = '' the citext "=" operator (in schema extensions) isn't found, so
-- `handle = x::citext` silently fell back to case-sensitive text equality and reported
-- "PRIVACY_T" as free when "privacy_t" was taken. Compare lowercased text explicitly.
-- (The unique index on profiles.handle was always case-insensitive; only this check erred.)
create or replace function public.handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_handle ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles
       where lower(handle::text) = lower(p_handle) and id is distinct from auth.uid()
     );
$$;

-- Same pitfall in the sign-up domain check: it only worked because domains are stored in
-- lowercase. Compare lowercased text so "UOS.edu.pk" in university_domains still matches.
create or replace function public.apply_uni_email(p_user uuid, p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_domain text := split_part(lower(p_email), '@', 2);
begin
  if p_email is null or not exists (
    select 1 from public.university_domains d
    join public.profiles p on p.university_id = d.university_id
    where p.id = p_user and lower(d.domain::text) = v_domain
  ) then
    return false;
  end if;

  update public.private_profile
     set uni_email = p_email,
         personal_email = case when lower(personal_email::text) = lower(p_email) then null
                               else personal_email end
   where user_id = p_user;
  update public.profiles
     set verification_status = 'verified', verification_method = 'uni_email', verified_at = now()
   where id = p_user and verification_status <> 'verified' and banned_at is null;
  -- A uni email supersedes any document still waiting for review.
  update public.verification_requests
     set status = 'verified', decision_reason = 'Verified by university email',
         decided_at = now(), updated_at = now()
   where user_id = p_user and status in ('pending','needs_info');
  return true;
end;
$$;
