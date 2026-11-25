-- Launch fix 5: alerts that go to many students at once (a timetable change for a whole
-- department, "your timetable is up", calendar reminders, launch announcements) no longer push
-- to every phone in the same second. Each one waits a random 0–90 seconds in a queue, and a job
-- every 15 seconds sends what's due, at most 200 at a time. The in-app notification itself
-- appears straight away; only the push is spread out. Everything personal (messages, requests,
-- replies) still pushes at once.

create table app_private.push_queue (
  notification_id uuid primary key references public.notifications on delete cascade,
  send_after timestamptz not null
);
create index push_queue_due_idx on app_private.push_queue (send_after);
revoke all on app_private.push_queue from public, anon, authenticated;

-- Types that fan out to many students at once.
create or replace function public.is_bulk_push(p_type text) returns boolean
language sql immutable set search_path = '' as $$
  select p_type in ('timetable.changed', 'timetable.published', 'calendar.reminder', 'feature.live');
$$;

create or replace function public.notifications_push() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id)
     and coalesce((select push from public.notification_prefs where user_id = new.user_id), true) then
    if public.is_bulk_push(new.type) then
      insert into app_private.push_queue (notification_id, send_after)
      values (new.id, now() + random() * interval '90 seconds')
      on conflict do nothing;
    else
      perform public.dispatch_push('notification', new.id);
    end if;
  end if;
  return new;
end;
$$;

-- Sends the pushes that are due. Rows are removed before sending, so a retry or an overlapping
-- run never pushes the same notification twice.
create or replace function public.send_queued_pushes(p_limit int default 200) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in
    with due as (
      select q.notification_id from app_private.push_queue q
      where q.send_after <= now()
      order by q.send_after
      limit greatest(p_limit, 1)
      for update skip locked
    )
    delete from app_private.push_queue q using due
    where q.notification_id = due.notification_id
    returning q.notification_id
  loop
    perform public.dispatch_push('notification', v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.send_queued_pushes(int) from public, anon, authenticated;
grant execute on function public.send_queued_pushes(int) to service_role;

select cron.schedule('push-queue', '15 seconds', 'select public.send_queued_pushes()');
