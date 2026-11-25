-- Launch fix 4: "Report wrong info" on every class and room. Students tell the department's
-- timetable editors when a room, time or teacher is wrong; editors see an open queue in
-- /admin/timetable and mark each report fixed or dismissed. A report keeps a copy of what the
-- student saw, because the next import replaces the class rows.

create table public.timetable_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references public.profiles on delete set null,
  department_id uuid references public.departments on delete cascade,
  entry_id uuid references public.timetable_entries on delete set null,
  room_id uuid references public.rooms on delete set null,
  kind text not null check (kind in ('room', 'time', 'teacher', 'cancelled', 'closed', 'other')),
  note text check (char_length(note) <= 300),
  seen jsonb not null default '{}',   -- course, room, teacher, day and times as shown
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed')),
  resolved_by uuid references public.profiles on delete set null,
  resolved_at timestamptz,
  check (entry_id is not null or room_id is not null)
);
create index timetable_reports_open_idx on public.timetable_reports (department_id, created_at)
  where status = 'open';
-- One open report per student per class or room.
create unique index timetable_reports_once_uq on public.timetable_reports
  (reporter_id, coalesce(entry_id, room_id)) where status = 'open';

alter table public.timetable_reports enable row level security;
-- Read through the functions below only.
revoke all on public.timetable_reports from anon, authenticated;
grant all on public.timetable_reports to service_role;

-- A verified student reports a class (p_entry) or a room (p_room). Up to 10 a day.
create or replace function public.report_timetable(
  p_entry uuid, p_room uuid, p_kind text, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_e public.timetable_entries;
  v_room public.rooms;
  v_dept uuid;
  v_seen jsonb;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if (select count(*) from public.timetable_reports
      where reporter_id = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s plenty of reports for today. Thank you!' using errcode = '54000';
  end if;
  if p_entry is not null then
    select * into v_e from public.timetable_entries where id = p_entry;
    if not found then
      raise exception 'That class isn''t on the timetable any more' using errcode = 'P0002';
    end if;
    v_dept := v_e.department_id;
    v_seen := jsonb_build_object('course', v_e.course_title, 'room', v_e.room_label,
      'teacher', v_e.teacher_name, 'day', v_e.day, 'start_min', v_e.start_min,
      'end_min', v_e.end_min);
  elsif p_room is not null then
    select * into v_room from public.rooms where id = p_room;
    if not found then
      raise exception 'That room isn''t listed any more' using errcode = 'P0002';
    end if;
    v_dept := v_room.department_id;
    v_seen := jsonb_build_object('room', coalesce(v_room.name, v_room.code));
  else
    raise exception 'Choose a class or a room' using errcode = '22023';
  end if;

  insert into public.timetable_reports (reporter_id, department_id, entry_id, room_id, kind,
                                        note, seen)
  values (v_me, v_dept, p_entry, coalesce(p_room, v_e.room_id), p_kind,
          nullif(left(trim(p_note), 300), ''), v_seen)
  on conflict (reporter_id, (coalesce(entry_id, room_id))) where status = 'open'
  do update set kind = excluded.kind, note = excluded.note, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- The open queue for the departments the caller edits (admins see every department).
create or replace function public.timetable_report_queue()
returns table (id uuid, created_at timestamptz, department text, kind text, note text,
               seen jsonb, entry_id uuid, room_id uuid, reports int)
language sql stable security definer set search_path = '' as $$
  select (array_agg(r.id order by r.created_at))[1], min(r.created_at), d.short_code,
         (array_agg(r.kind order by r.created_at desc))[1],
         (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
         (array_agg(r.seen order by r.created_at desc))[1],
         r.entry_id, r.room_id, count(*)::int
  from public.timetable_reports r
  left join public.departments d on d.id = r.department_id
  where r.status = 'open'
    and (public.is_admin() or public.is_data_editor(r.department_id, 'timetable'))
  group by r.entry_id, r.room_id, d.short_code
  order by min(r.created_at)
  limit 100;
$$;

-- Close every open report about the same class or room at once.
create or replace function public.resolve_timetable_report(p_report uuid, p_status text)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_r public.timetable_reports;
  v_n int;
begin
  if p_status not in ('fixed', 'dismissed') then
    raise exception 'Choose fixed or dismissed' using errcode = '22023';
  end if;
  select * into v_r from public.timetable_reports where id = p_report;
  if not found or not (public.is_admin() or public.is_data_editor(v_r.department_id, 'timetable')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.timetable_reports set status = p_status, resolved_by = auth.uid(),
         resolved_at = now()
  where status = 'open' and entry_id is not distinct from v_r.entry_id
    and room_id is not distinct from v_r.room_id;
  get diagnostics v_n = row_count;
  insert into public.audit_log (actor_id, action, target_type, target_id, after)
  values (auth.uid(), 'timetable_report.' || p_status, 'timetable_report', p_report,
          jsonb_build_object('closed', v_n));
  return v_n;
end;
$$;

revoke all on function public.report_timetable(uuid, uuid, text, text),
  public.timetable_report_queue(), public.resolve_timetable_report(uuid, text)
  from public, anon;
grant execute on function public.report_timetable(uuid, uuid, text, text),
  public.timetable_report_queue(), public.resolve_timetable_report(uuid, text)
  to authenticated, service_role;
