-- API role privileges are explicit (20261025090000_api_role_grants.sql), so they match on the
-- local stack and on hosted projects. A missing grant fails here instead of silently in prod.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select table_privs_are('public', 'departments', 'anon', array['SELECT'],
  'visitors can read the catalogue');
select table_privs_are('public', 'university_requests', 'anon', array['INSERT'],
  'visitors can only add themselves to the waitlist');
select table_privs_are('public', 'profiles', 'anon', array[]::text[],
  'visitors cannot touch profiles');
select table_privs_are('public', 'private_profile', 'anon', array[]::text[],
  'visitors cannot touch PII');
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT', 'UPDATE'],
  'students read and edit profiles (RLS decides which)');
select table_privs_are('public', 'private_profile', 'authenticated', array['SELECT'],
  'PII is read-only for students; writes go through functions');
select table_privs_are('public', 'verification_requests', 'authenticated', array['SELECT'],
  'requests are written only through submit/decide functions');
select ok(has_table_privilege('service_role', 'public.private_profile', 'SELECT,UPDATE,INSERT,DELETE'),
  'the service role has full access');

select * from finish();
rollback;
