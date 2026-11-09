-- Nothing flagged a roll number another account already used unless the AI pre-check was on.
-- This is for the reviewer to judge, not a hard rule: forbidding duplicates would let anyone
-- lock a real student out by typing their number first. Every submission's number is stored
-- on private_profile, so this also finds other pending, rejected and banned accounts.
create index private_profile_roll_no_idx on public.private_profile (roll_no) where roll_no is not null;
create index private_profile_registration_no_idx on public.private_profile (registration_no)
  where registration_no is not null;

create function public.verification_duplicates()
returns table (request_id uuid, full_name text, handle text, status text)
language sql stable security definer set search_path = '' as $$
  select r.id, o.full_name, o.handle::text,
         case when o.banned_at is not null then 'banned' else o.verification_status::text end
  from public.verification_requests r
  join public.private_profile pp
    on pp.user_id <> r.user_id and r.roll_no_submitted in (pp.roll_no, pp.registration_no)
  join public.profiles o on o.id = pp.user_id
  where public.is_admin() and r.status = 'pending';
$$;
revoke execute on function public.verification_duplicates() from public, anon;
grant execute on function public.verification_duplicates() to authenticated;
