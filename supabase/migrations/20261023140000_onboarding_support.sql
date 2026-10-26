-- Phase 1 onboarding support: public counters, realtime for /pending, Google off until configured.

-- Aggregate counts for the welcome marquee. Exposes numbers only, never rows.
create or replace function public.public_stats() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'students', (select count(*) from public.profiles
                 where verification_status = 'verified' and banned_at is null and deleted_at is null),
    'departments', (select count(*) from public.departments)
  );
$$;
grant execute on function public.public_stats() to anon, authenticated;

-- /pending listens for its own profile and request changes (RLS still filters rows).
alter publication supabase_realtime add table public.profiles, public.verification_requests;

-- Kill switch: hide "Continue with Google" until the OAuth client is set up in Supabase.
-- Turn it on with: update public.auth_providers set live = true where mail_host = 'google';
update public.auth_providers set live = false where mail_host = 'google';
