-- Launch fix 3: off switches an admin can flip in /admin/flags, with no redeploy. Each one is
-- enforced in the database where it can be (the app only shows a friendly message):
--   chat              students can read chats but not send (system messages still go through)
--   ai_buddy          AIBuddy stops answering (checked by /api/buddy and the AIBuddy screen)
--   timetable_alerts  publishing a timetable sends no change alerts
--   signups           no new accounts (existing students still log in)
-- All four start switched on, so nothing changes until an admin turns one off.

insert into public.feature_flags (key, enabled, note) values
  ('chat', true, 'Launch fix 3: off = chats are read-only for everyone.'),
  ('ai_buddy', true, 'Launch fix 3: off = AIBuddy shows "taking a short break".'),
  ('timetable_alerts', true, 'Launch fix 3: off = publishing a timetable sends no alerts.'),
  ('signups', true, 'Launch fix 3: off = no new accounts; existing students still log in.')
on conflict (key) do nothing;

-- A kill switch is on unless an admin has turned it off (a missing row means on). Not a definer
-- function: feature_flags is readable by everyone already.
create or replace function public.switch_on(p_key text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select enabled from public.feature_flags where key = p_key), true);
$$;
grant execute on function public.switch_on(text) to anon, authenticated, service_role;

-- Chat: block students' messages while chat is off.
create or replace function public.chat_switch_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_id is not null and not public.switch_on('chat') then
    raise exception 'Chat is paused for a little while. Try again soon.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger messages_chat_switch
  before insert on public.messages
  for each row execute function public.chat_switch_guard();

-- Sign-ups: no new auth users while sign-ups are off. Supabase Auth reports this as
-- "Database error saving new user", which the app shows as "New sign-ups are paused".
create or replace function public.signup_switch_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.switch_on('signups') then
    raise exception 'New sign-ups are paused' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger on_auth_user_signup_switch
  before insert on auth.users
  for each row execute function public.signup_switch_guard();

-- Timetable alerts: publishing still works; only the alerts are skipped.
create or replace function public.notify_timetable_publish(p_import uuid, p_first boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.timetable_imports;
  v_sent int := 0;
  r record;
begin
  if not public.switch_on('timetable_alerts') then
    return 0;
  end if;
  select * into v_imp from public.timetable_imports where id = p_import;
  for r in
    with ch as (
      select c.id, c.class_group_id, c.kind, c.before, c.after,
             upper(regexp_replace(coalesce(c.after->>'course_code', c.before->>'course_code', ''),
                                  '[^A-Za-z0-9]', '', 'g')) as code
      from public.timetable_changes c where c.import_id = p_import
    ), hits as (
      select s.uid as user_id, ch.* from ch
      cross join lateral public.class_group_students(ch.class_group_id) as s(uid)
      union
      select f.user_id, ch.* from ch
      join public.timetable_follows f
        on (f.class_group_id is null or f.class_group_id = ch.class_group_id)
       and (f.course_id is null or f.course_id in (
              select co.id from public.courses co
              where co.department_id = v_imp.department_id and co.code_norm = ch.code))
    )
    select h.user_id, count(*)::int as n,
           (array_agg(jsonb_build_object('kind', h.kind, 'before', h.before, 'after', h.after)
                      order by case h.kind when 'moved' then 0 when 'retimed' then 1
                                 when 'removed' then 2 when 'teacher' then 3 else 4 end, h.id))[1]
             as first
    from hits h
    group by h.user_id
  loop
    perform public.notify(r.user_id,
      case when p_first then 'timetable.published' else 'timetable.changed' end,
      -- No actor: the department publishes it, and a block must never hide a timetable change.
      null, 'timetable_import', p_import,
      jsonb_build_object('count', r.n, 'term', v_imp.term, 'first', r.first));
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

-- Trigger functions are never called directly.
revoke all on function public.chat_switch_guard(), public.signup_switch_guard()
  from public, anon, authenticated;
