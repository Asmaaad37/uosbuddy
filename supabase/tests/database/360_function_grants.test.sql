-- Hardening guard: no function that runs with the owner's rights (security definer) may be
-- callable by a logged-out visitor (anon), except the access-rule helpers that policies call,
-- the landing page's stats, invite link previews (seen before signing up) and feature flags.
-- Trigger functions can't be called directly, so they're left out. A new definer function
-- must revoke EXECUTE from public and anon.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is(
  (select coalesce(array_agg(p.oid::regprocedure::text order by 1), '{}')
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('is_verified', 'is_admin', 'my_university_id', 'is_member',
                           'can_use_topic', 'can_use_conversation_path', 'public_stats',
                           'invite_preview', 'flag')),
  '{}'::text[],
  'logged-out visitors can''t call owner-rights functions'
);

select * from finish();
rollback;
