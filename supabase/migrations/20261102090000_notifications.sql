-- Phase 5 (part 1a): notifications, per-type preferences, push subscriptions, feature
-- flags. Notifications are written only by security-definer code (triggers and functions);
-- students read and mark their own. Push delivery is added in part 3.

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text
);
alter table public.feature_flags enable row level security;
create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);
create policy feature_flags_admin on public.feature_flags for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to anon, authenticated;
grant insert, update, delete on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;
insert into public.feature_flags (key, enabled, note) values
  ('anonymous_posts', false, 'Phase 5 task 3: anonymous feed posts (P1). Off until moderation is staffed.');

create or replace function public.flag(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), false);
$$;

-- ---------------------------------------------------------------------------
-- Notifications (§4.3)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in (
    'connect.request', 'connect.accepted',
    'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
    'post.comment', 'comment.reply'
  )),
  -- Null for anonymous actors: who did it is never stored where the recipient can read it.
  actor_id uuid references public.profiles on delete set null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}',
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter publication supabase_realtime add table public.notifications;

-- Which kinds of notification a student wants. A missing row means everything on.
create table public.notification_prefs (
  user_id uuid primary key references public.profiles on delete cascade,
  connections boolean not null default true,
  backup boolean not null default true,
  comments boolean not null default true,
  messages boolean not null default true,
  push boolean not null default true
);
alter table public.notification_prefs enable row level security;
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;

-- Whether a student wants this kind of notification (by the prefs group it belongs to).
create or replace function public.wants(p_user uuid, p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case split_part(p_type, '.', 1)
      when 'connect' then p.connections
      when 'backup' then p.backup
      when 'post' then p.comments
      when 'comment' then p.comments
      when 'message' then p.messages
      else true end
    from public.notification_prefs p where p.user_id = p_user
  ), true);
$$;

-- The one way notifications get written. Skips self-notifications, muted types and blocks.
create or replace function public.notify(
  p_user uuid, p_type text, p_actor uuid, p_entity_type text, p_entity_id uuid,
  p_payload jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor or not public.wants(p_user, p_type) then
    return;
  end if;
  if p_actor is not null and public.blocked_between(p_user, p_actor) then
    return;
  end if;
  insert into public.notifications (user_id, type, actor_id, entity_type, entity_id, payload)
  values (p_user, p_type, p_actor, p_entity_type, p_entity_id, coalesce(p_payload, '{}'));
end;
$$;

-- Everything read up to now (or one notification).
create or replace function public.mark_notifications_read(p_id uuid default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
$$;

-- The notification centre: newest first, with who did it (as privacy allows).
create or replace function public.my_notifications(p_limit int default 50)
returns table (id uuid, created_at timestamptz, type text, entity_type text, entity_id uuid,
               payload jsonb, read_at timestamptz,
               actor_handle text, actor_name text, actor_avatar text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.created_at, n.type, n.entity_type, n.entity_id, n.payload, n.read_at,
    a.handle::text, a.full_name,
    case when a.id is not null and public.visible_at(a.id,
      (select photo_visibility from public.privacy_settings where user_id = a.id))
      then a.avatar_url end
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  where n.user_id = auth.uid()
    and (a.id is null or not public.blocked_between(auth.uid(), a.id))
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Connections notify: a new request, and an accepted one.
create or replace function public.connections_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending'
                                 or old.requester_id is distinct from new.requester_id) then
    perform public.notify(new.addressee_id, 'connect.request', new.requester_id,
                          'profile', new.requester_id, jsonb_build_object('message', new.message));
  elsif new.status = 'accepted' and tg_op = 'UPDATE' and old.status = 'pending' then
    perform public.notify(new.requester_id, 'connect.accepted', new.addressee_id,
                          'profile', new.addressee_id);
  end if;
  return new;
end;
$$;
create trigger connections_notify after insert or update on public.connections
  for each row execute function public.connections_notify();

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (one per browser)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

revoke execute on function public.notify(uuid, text, uuid, text, uuid, jsonb),
  public.wants(uuid, text), public.connections_notify()
  from public, anon, authenticated;
revoke execute on function public.mark_notifications_read(uuid), public.my_notifications(int),
  public.flag(text) from public, anon;
grant execute on function public.mark_notifications_read(uuid), public.my_notifications(int)
  to authenticated;
grant execute on function public.flag(text) to anon, authenticated;
