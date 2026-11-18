-- Phase 11.3: lookup (any section), teacher and room views, the free-room finder, and change
-- alerts. One function gives this week's live classes (a week's amendment replaces that
-- department's term rows); the views and the free-room finder read it. Publishing now tells
-- every affected student once: their section's changes and the classes they follow.

-- ===========================================================================
-- This week's live classes in the student's university.
-- ===========================================================================
create or replace function public.live_entries() returns setof public.timetable_entries
language sql stable security definer set search_path = '' as $$
  select e.* from public.timetable_entries e
  join public.departments d on d.id = e.department_id
  where public.is_verified() and e.live and e.term = public.current_term()
    and d.university_id = public.my_university_id()
    and (e.week_of = public.this_week()
         or (e.week_of is null and not exists (
               select 1 from public.timetable_entries a
               where a.live and a.department_id = e.department_id and a.term = e.term
                 and a.week_of = public.this_week())));
$$;

create or replace function public.my_timetable() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_term text := public.current_term();
  v_week date := public.this_week();
  v_group uuid;
  v_choice boolean;
  v_label text;
  v_dept uuid;
  v_published timestamptz;
  v_classes jsonb;
begin
  if not public.is_verified() then
    return jsonb_build_object('group', null, 'matched', null, 'term', v_term, 'classes', '[]'::jsonb);
  end if;
  v_choice := exists (select 1 from public.timetable_settings
                      where user_id = auth.uid() and class_group_id is not null);
  v_group := public.my_class_group();
  select g.label, g.department_id into v_label, v_dept from public.class_groups g where g.id = v_group;
  select max(i.published_at) into v_published from public.timetable_imports i
  where i.department_id = v_dept and i.term = v_term and i.status = 'published';

  with live as (
    select * from public.live_entries()
  ), mine as (
    select l.*, null::uuid as follow_id from live l where l.class_group_id = v_group
  ), followed as (
    select l.*, f.id as follow_id from live l
    join public.timetable_follows f on f.user_id = auth.uid()
      and (f.class_group_id is null or f.class_group_id = l.class_group_id)
      and (f.course_id is null or f.course_id = l.course_id)
    where v_group is null or l.class_group_id <> v_group
  ), merged as (
    select distinct on (day, start_min, course_key, room_label) *
    from (select * from mine union all select * from followed) x
    order by day, start_min, course_key, room_label, follow_id nulls first
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'course_title', m.course_title, 'course_code', m.course_code,
      'room_label', m.room_label, 'room_id', m.room_id, 'teacher_name', m.teacher_name,
      'teacher_id', m.teacher_id,
      'day', m.day, 'start_min', m.start_min, 'end_min', m.end_min, 'practical', m.practical,
      'group_label', case when m.follow_id is not null then g.label end,
      'follow_id', m.follow_id)
      order by m.day, m.start_min), '[]'::jsonb)
    into v_classes
  from merged m join public.class_groups g on g.id = m.class_group_id;

  return jsonb_build_object(
    'group', case when v_group is null then null
                  else jsonb_build_object('id', v_group, 'label', v_label) end,
    'matched', case when v_group is null then null when v_choice then 'choice' else 'profile' end,
    'term', v_term, 'week_of', v_week, 'published_at', v_published, 'classes', v_classes);
end;
$$;


-- A section's, teacher's or room's week: {title, subtitle, room: {...} | null, classes: [...]}.
create or replace function public.timetable_view(p_kind text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_title text;
  v_subtitle text;
  v_room jsonb;
  v_classes jsonb;
begin
  if not public.is_verified() or p_kind not in ('section', 'teacher', 'room') then
    return null;
  end if;
  if p_kind = 'section' then
    select g.label, dep.name into v_title, v_subtitle from public.class_groups g
    join public.departments dep on dep.id = g.department_id
    where g.id = p_id and dep.university_id = public.my_university_id();
  elsif p_kind = 'teacher' then
    select t.name, coalesce(t.title, dep.name) into v_title, v_subtitle from public.teachers t
    left join public.departments dep on dep.id = t.department_id
    where t.id = p_id and t.university_id = public.my_university_id();
  else
    select coalesce(b.code || ' ', '') || r.code,
           nullif(concat_ws(' · ', b.name, case when r.floor is not null then 'Floor ' || r.floor end,
                     case when r.capacity is not null then r.capacity || ' seats' end), ''),
           jsonb_build_object('kind', r.kind, 'floor', r.floor, 'capacity', r.capacity,
                              'building', b.code)
      into v_title, v_subtitle, v_room
    from public.rooms r left join public.buildings b on b.id = r.building_id
    where r.id = p_id and r.university_id = public.my_university_id();
  end if;
  if v_title is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'course_title', e.course_title, 'course_code', e.course_code,
      'room_label', e.room_label, 'room_id', e.room_id, 'teacher_name', e.teacher_name,
      'teacher_id', e.teacher_id, 'day', e.day, 'start_min', e.start_min, 'end_min', e.end_min,
      'practical', e.practical, 'group_label', g.label, 'group_id', g.id)
      order by e.day, e.start_min, g.label), '[]'::jsonb)
    into v_classes
  from public.live_entries() e join public.class_groups g on g.id = e.class_group_id
  where (p_kind = 'section' and e.class_group_id = p_id)
     or (p_kind = 'teacher' and e.teacher_id = p_id)
     or (p_kind = 'room' and e.room_id = p_id);
  return jsonb_build_object('title', v_title, 'subtitle', v_subtitle, 'room', v_room,
                            'classes', v_classes);
end;
$$;

-- Pickers for Lookup: teachers with classes this week, and every room (with or without).
create or replace function public.timetable_teachers()
returns table (id uuid, name text, department text)
language sql stable security definer set search_path = '' as $$
  select distinct t.id, t.name, d.short_code
  from public.live_entries() e
  join public.teachers t on t.id = e.teacher_id
  left join public.departments d on d.id = t.department_id
  order by t.name;
$$;

create or replace function public.timetable_rooms()
returns table (id uuid, label text, building text, floor smallint, kind public.room_kind)
language sql stable security definer set search_path = '' as $$
  select r.id, coalesce(b.code || ' ', '') || r.code, b.code, r.floor, r.kind
  from public.rooms r left join public.buildings b on b.id = r.building_id
  where public.is_verified() and r.university_id = public.my_university_id()
  order by b.code nulls last, r.code;
$$;

-- ===========================================================================
-- Change alerts.
-- ===========================================================================
alter table public.notification_prefs add column timetable boolean not null default true;

create or replace function public.wants(p_user uuid, p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case split_part(p_type, '.', 1)
      when 'connect' then p.connections
      when 'mentor' then p.connections
      when 'backup' then p.backup
      when 'post' then p.comments
      when 'comment' then p.comments
      when 'message' then p.messages
      when 'ping' then p.messages
      when 'timetable' then p.timetable
      else true end
    from public.notification_prefs p where p.user_id = p_user
  ), true);
$$;

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
  'timetable.changed', 'timetable.published'
));

-- Students in a class group: their own choice, or (with no choice) a profile that matches its
-- program, year joined and section, with the semester pointing to the same Fall or Spring
-- intake (as my_class_group does).
create or replace function public.class_group_students(p_group uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.class_groups g
  join public.profiles p on p.program_id = g.program_id and p.batch_year = g.intake_year
    and p.section = g.section
  left join public.timetable_settings s on s.user_id = p.id
  where g.id = p_group and s.class_group_id is null
    and p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
    and (g.intake_term is null
         or g.intake_term = public.intake_season(public.current_term(), p.semester))
  union
  select s.user_id from public.timetable_settings s where s.class_group_id = p_group;
$$;

-- One notification per affected student for a publish: their section's changes, plus changes
-- to classes they follow. The first publish of a term says the timetable is up instead.
-- Pushes go out through the existing notification webhook.
create or replace function public.notify_timetable_publish(p_import uuid, p_first boolean)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.timetable_imports;
  v_sent int := 0;
  r record;
begin
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

create or replace function public.publish_import(p_import uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.timetable_imports;
  v_summary jsonb;
  v_first boolean;
begin
  select * into v_imp from public.timetable_imports where id = p_import for update;
  if v_imp.id is null or not public.is_data_editor(v_imp.department_id, 'timetable') then
    raise exception 'Import not found' using errcode = '42501';
  end if;
  if v_imp.status <> 'review' then
    raise exception 'This import is already %', v_imp.status using errcode = '22023';
  end if;
  if not exists (select 1 from public.timetable_entries where import_id = p_import and not excluded) then
    raise exception 'Nothing to publish: every class is excluded' using errcode = '22023';
  end if;
  -- One publish at a time per department and term.
  perform pg_advisory_xact_lock(hashtextextended(v_imp.department_id::text || v_imp.term, 0));

  -- The first timetable for this department, term and week: students hear "it's up".
  v_first := not exists (select 1 from public.timetable_entries
                         where live and department_id = v_imp.department_id and term = v_imp.term
                           and week_of is not distinct from v_imp.week_of);

  insert into public.timetable_changes (import_id, department_id, class_group_id, kind, before, after)
  select p_import, v_imp.department_id, d.class_group_id, d.kind, d.before, d.after
  from public.import_diff(p_import) d;

  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into v_summary
  from (select kind as k, count(*) as n from public.timetable_changes
        where import_id = p_import group by kind) s;

  update public.timetable_entries set live = false
  where live and import_id <> p_import and department_id = v_imp.department_id
    and term = v_imp.term and week_of is not distinct from v_imp.week_of;
  update public.timetable_entries set live = not excluded where import_id = p_import;
  update public.timetable_imports
     set status = 'published', published_by = auth.uid(), published_at = clock_timestamp(),
         diff_summary = v_summary
   where id = p_import;

  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (auth.uid(), 'timetable.publish', 'timetable_import', p_import, v_summary);
  perform public.notify_timetable_publish(p_import, v_first);
  return v_summary;
end;
$$;


revoke execute on function public.live_entries(), public.timetable_view(text, uuid),
  public.timetable_teachers(), public.timetable_rooms(), public.class_group_students(uuid),
  public.notify_timetable_publish(uuid, boolean)
  from public, anon;
grant execute on function public.live_entries(), public.timetable_view(text, uuid),
  public.timetable_teachers(), public.timetable_rooms()
  to authenticated, service_role;
-- Only publish_import (a definer function) sends alerts; students can't call these directly.
revoke execute on function public.class_group_students(uuid),
  public.notify_timetable_publish(uuid, boolean) from authenticated;
grant execute on function public.class_group_students(uuid),
  public.notify_timetable_publish(uuid, boolean) to service_role;
