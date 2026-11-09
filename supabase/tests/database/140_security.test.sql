-- Phase 10 security review: guarantees that must hold for every table and function, now
-- and for anything added later.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '', 'every table in public has row-level security on');

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '', 'every security-definer function pins its search_path');

select is(
  (select coalesce(string_agg(distinct table_name || ':' || privilege_type, ', '), '')
   from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  -- Even the waitlist goes through the server, after the bot check and rate limit.
  '', 'signed-out visitors can''t write anything directly');

select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'app_private' and c.relkind = 'r'
     and (has_table_privilege('authenticated', c.oid, 'select')
          or has_table_privilege('anon', c.oid, 'select'))),
  '', 'private config (secrets) is unreadable from the API roles');

select * from finish();
rollback;
