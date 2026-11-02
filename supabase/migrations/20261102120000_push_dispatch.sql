-- Phase 5 (part 3): Web Push delivery. New notifications and chat messages ask the app to
-- push them: pg_net posts {kind, id} to the app's /api/push with a shared secret, and the
-- app (holding the VAPID key) sends the push. Configure per environment:
--   insert into app_private.config values
--     ('push_url', 'https://<site>/api/push'), ('push_secret', '<same as PUSH_WEBHOOK_SECRET>');
-- Until both are set nothing is sent, which is right for local development.

create extension if not exists pg_net with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.config (
  key text primary key,
  value text not null
);
revoke all on app_private.config from public, anon, authenticated;

create or replace function public.dispatch_push(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from app_private.config where key = 'push_url';
  select value into v_secret from app_private.config where key = 'push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
end;
$$;

-- A notification for someone with push turned on and at least one subscribed browser.
create or replace function public.notifications_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id)
     and coalesce((select push from public.notification_prefs where user_id = new.user_id), true) then
    perform public.dispatch_push('notification', new.id);
  end if;
  return new;
end;
$$;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.notifications_push();

-- A chat message, if any other member could get a push for it (the app filters further).
create or replace function public.messages_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.conversation_members m
    join public.push_subscriptions s on s.user_id = m.user_id
    where m.conversation_id = new.conversation_id and m.user_id is distinct from new.sender_id
      and not m.muted
  ) then
    perform public.dispatch_push('message', new.id);
  end if;
  return new;
end;
$$;
create trigger messages_push after insert on public.messages
  for each row execute function public.messages_push();

revoke execute on function public.dispatch_push(text, uuid), public.notifications_push(),
  public.messages_push() from public, anon, authenticated;
