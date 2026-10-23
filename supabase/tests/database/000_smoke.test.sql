-- Smoke test: proves the pgTAP harness runs. Real RLS tests arrive with the Phase 1 migrations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select has_schema('public');
select has_schema('auth');

select * from finish();
rollback;
