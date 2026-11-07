-- Admin → Launch check: what an admin needs to see to know the live site is set up, without
-- ever showing a secret.
-- 1. launch_status(): push wiring (push_url, whether push_secret is set, how the last pushes
--    went), scheduled jobs, push devices and admins. Admins only.
-- 2. send_test_notification(): a notification to yourself. It goes the real way (the
--    notifications trigger → pg_net → /api/push → Web Push), so it proves the whole chain.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test'
));

create or replace function public.launch_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_push jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  -- pg_net keeps responses for about six hours; /api/push is the only thing that uses it.
  begin
    select jsonb_build_object(
      'ok', count(*) filter (where status_code between 200 and 299),
      'failed', count(*) filter (where status_code is null or status_code not between 200 and 299),
      'last_status', (select r.status_code from net._http_response r order by r.created desc limit 1),
      'last_error', (select left(r.error_msg, 200) from net._http_response r
                     where r.error_msg is not null order by r.created desc limit 1))
    into v_push
    from net._http_response;
  exception when others then
    v_push := null;
  end;

  return jsonb_build_object(
    'push_url', (select value from app_private.config where key = 'push_url'),
    'push_secret', exists (select 1 from app_private.config where key = 'push_secret' and value <> ''),
    'recent_pushes', v_push,
    'crons', coalesce((select jsonb_agg(jsonb_build_object('name', jobname, 'active', active)
                                        order by jobname) from cron.job), '[]'::jsonb),
    'my_devices', (select count(*) from public.push_subscriptions where user_id = auth.uid()),
    'devices', (select count(*) from public.push_subscriptions),
    'my_push_on', coalesce((select push from public.notification_prefs where user_id = auth.uid()), true),
    'admins', (select count(*) from public.profiles where role = 'admin' and banned_at is null)
  );
end;
$$;

create or replace function public.send_test_notification() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  insert into public.notifications (user_id, type, payload)
  values (auth.uid(), 'system.test', jsonb_build_object('at', now()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.launch_status(), public.send_test_notification()
  from public, anon;
grant execute on function public.launch_status(), public.send_test_notification()
  to authenticated;
