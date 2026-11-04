-- Phase 9: data exports live in a private bucket with no student policies; the server
-- writes them with the service role and hands out 7-day signed links. One a day.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('data-exports', 'data-exports', false, 52428800, array['application/json'])
on conflict (id) do nothing;

create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  path text not null
);
create index data_exports_user_idx on public.data_exports (user_id, created_at desc);
alter table public.data_exports enable row level security;
create policy data_exports_own on public.data_exports for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.data_exports from anon, authenticated;
grant select on public.data_exports to authenticated;
grant all on public.data_exports to service_role;
