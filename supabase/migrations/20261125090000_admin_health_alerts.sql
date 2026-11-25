-- Launch fix 2: tell admins when work is piling up. Once a day (09:00 Pakistan time) every admin
-- gets a notification if a verification has waited more than 24 hours, or a timetable import has
-- sat in review that long (students are still seeing the old version). Nothing is sent when both
-- queues are fine.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'backup.expired',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted', 'mentor.ended',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test',
  'studies.approved', 'studies.rejected',
  'timetable.changed', 'timetable.published', 'calendar.reminder',
  'admin.verifications', 'admin.imports'
));

create or replace function public.admin_health_alerts()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_ver_n int;
  v_ver_hours int;
  v_imp_n int;
  v_sent int := 0;
  a record;
begin
  select count(*)::int, floor(extract(epoch from now() - min(created_at)) / 3600)::int
    into v_ver_n, v_ver_hours
  from public.verification_requests
  where status = 'pending' and created_at < now() - interval '24 hours';

  select count(*)::int into v_imp_n
  from public.timetable_imports
  where status = 'review' and created_at < now() - interval '24 hours';

  if v_ver_n = 0 and v_imp_n = 0 then
    return 0;
  end if;

  for a in
    select id from public.profiles where role = 'admin' and banned_at is null and deleted_at is null
  loop
    if v_ver_n > 0 then
      perform public.notify(a.id, 'admin.verifications', null, null, null,
        jsonb_build_object('count', v_ver_n, 'hours', v_ver_hours));
      v_sent := v_sent + 1;
    end if;
    if v_imp_n > 0 then
      perform public.notify(a.id, 'admin.imports', null, null, null,
        jsonb_build_object('count', v_imp_n));
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end;
$$;

revoke all on function public.admin_health_alerts() from public, anon, authenticated;
grant execute on function public.admin_health_alerts() to service_role;

-- 04:00 UTC = 09:00 in Pakistan.
select cron.schedule('admin-health-alerts', '0 4 * * *', 'select public.admin_health_alerts()');
