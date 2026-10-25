-- Explicit table privileges for the API roles. Newer hosted projects grant nothing by default,
-- while the local stack grants everything; revoking first makes both identical and least-privilege.
-- RLS still filters rows: these grants only decide which operations can reach the policies.

revoke all on all tables in schema public from anon, authenticated;

-- Catalogue: anyone may read (sign-up runs before login); admin writes pass through RLS.
grant select on public.universities, public.campuses, public.university_domains,
  public.auth_providers, public.departments, public.programs, public.courses
  to anon, authenticated;
grant insert, update, delete on public.universities, public.campuses, public.university_domains,
  public.auth_providers, public.departments, public.programs, public.courses
  to authenticated;

-- Waitlist: anyone may join; only admins read (RLS).
grant insert on public.university_requests to anon, authenticated;
grant select on public.university_requests to authenticated;

-- Identity: reads filtered by RLS; edits only where a policy allows (own profile, own privacy).
grant select on public.profiles, public.private_profile, public.privacy_settings,
  public.verification_requests, public.audit_log
  to authenticated;
grant update on public.profiles, public.privacy_settings to authenticated;

-- Server code and the AI worker use the service role, which bypasses RLS.
grant all on all tables in schema public to service_role;
alter default privileges for role postgres in schema public grant all on tables to service_role;

-- Helpers evaluated inside RLS policies run with the caller's privileges.
grant execute on function public.is_verified(), public.is_admin(), public.my_university_id()
  to authenticated;
