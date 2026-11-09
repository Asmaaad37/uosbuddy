-- Department, session, section and shift decide which chats, feeds and privacy levels a
-- student reaches, so once setup is finished they only change with proof an admin approved.
-- A student gets one approved change; an admin can allow another. Sections are now the
-- university's own: REG (regular), SS1 and SS2 (self-support), or none.

-- Old free-text sections (A, B, 2...) don't map to these, so those students pick again.
-- Picking from empty is free, and they keep any section chat they had already joined.
update public.profiles
   set section = case when upper(trim(section)) in ('REG', 'SS1', 'SS2') then upper(trim(section)) end
 where section is not null;
alter table public.profiles add constraint profiles_section_known
  check (section in ('REG', 'SS1', 'SS2'));

create table public.studies_change_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  department_id uuid not null references public.departments,
  program_id uuid not null references public.programs,
  batch_year int not null,
  semester int not null,
  section text check (section in ('REG', 'SS1', 'SS2')),
  shift public.shift_type not null,
  doc_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles on delete set null,
  decision_reason text,
  decided_at timestamptz
);
create unique index studies_change_requests_open_uq
  on public.studies_change_requests (user_id) where status = 'pending';
create index studies_change_requests_user_idx
  on public.studies_change_requests (user_id, created_at desc);
create index studies_change_requests_queue_idx
  on public.studies_change_requests (status, created_at);

alter table public.studies_change_requests enable row level security;
create policy studies_change_requests_read on public.studies_change_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
grant select on public.studies_change_requests to authenticated;

-- Setup step 1, and Me → Studies. After setup only program and semester are free, plus
-- filling in a section or shift that was still empty.
create or replace function public.save_my_academic(
  p_department uuid, p_program uuid, p_batch int, p_semester int, p_section text,
  p_shift public.shift_type
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_semesters int;
  v_section text := nullif(trim(p_section), '');
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid() for update;

  select duration_semesters into v_semesters from public.programs
  where id = p_program and department_id = p_department;
  if v_semesters is null then
    raise exception 'Choose a program from your department' using errcode = '22023';
  end if;
  if p_semester not between 1 and v_semesters then
    raise exception 'That program has % semesters.', v_semesters using errcode = '22023';
  end if;
  if v_section not in ('REG', 'SS1', 'SS2') then
    raise exception 'Choose REG, SS1 or SS2' using errcode = '22023';
  end if;

  if v_me.onboarding_step >= 4 and (
       p_department is distinct from v_me.department_id
       or p_batch is distinct from v_me.batch_year
       or (v_me.section is not null and v_section is distinct from v_me.section)
       or (v_me.shift is not null and p_shift is distinct from v_me.shift)) then
    raise exception 'Changing your department, session, section or shift needs proof.'
      using errcode = '42501';
  end if;

  update public.profiles
     set department_id = p_department, program_id = p_program, batch_year = p_batch,
         semester = p_semester, section = v_section, shift = p_shift,
         onboarding_step = greatest(onboarding_step, 1)
   where id = v_me.id;
end;
$$;

-- A student asks for the change. Asking again while one is open replaces it.
create or replace function public.request_studies_change(
  p_department uuid, p_program uuid, p_batch int, p_semester int, p_section text,
  p_shift public.shift_type, p_doc_path text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_semesters int;
  v_section text := nullif(trim(p_section), '');
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid() for update;
  if v_me.onboarding_step < 4 then
    raise exception 'Finish setting up your profile first' using errcode = '22023';
  end if;
  if v_me.studies_changed_at is not null then
    raise exception 'You''ve already changed your studies once. Ask an admin to allow another change.'
      using errcode = '42501';
  end if;

  select duration_semesters into v_semesters from public.programs
  where id = p_program and department_id = p_department;
  if v_semesters is null then
    raise exception 'Choose a program from your department' using errcode = '22023';
  end if;
  if p_semester not between 1 and v_semesters then
    raise exception 'That program has % semesters.', v_semesters using errcode = '22023';
  end if;
  if v_section not in ('REG', 'SS1', 'SS2') then
    raise exception 'Choose REG, SS1 or SS2' using errcode = '22023';
  end if;
  if p_shift is null then
    raise exception 'Choose your shift' using errcode = '22023';
  end if;
  if (p_department, p_batch, v_section, p_shift)
     is not distinct from (v_me.department_id, v_me.batch_year, v_me.section, v_me.shift) then
    raise exception 'Change your department, session, section or shift first' using errcode = '22023';
  end if;
  if p_doc_path is null or split_part(p_doc_path, '/', 1) <> v_me.id::text
     or not exists (select 1 from storage.objects
                    where bucket_id = 'verification-docs' and name = p_doc_path) then
    raise exception 'Upload your proof first' using errcode = '22023';
  end if;

  update public.studies_change_requests
     set department_id = p_department, program_id = p_program, batch_year = p_batch,
         semester = p_semester, section = v_section, shift = p_shift, doc_path = p_doc_path,
         created_at = now()
   where user_id = v_me.id and status = 'pending';
  if not found then
    insert into public.studies_change_requests
      (user_id, department_id, program_id, batch_year, semester, section, shift, doc_path)
    values (v_me.id, p_department, p_program, p_batch, p_semester, v_section, p_shift, p_doc_path);
  end if;
end;
$$;

-- Admin → Studies. Approving applies the change and uses up the student's one change;
-- rejecting doesn't, so they can try again with better proof.
create or replace function public.decide_studies_change(
  p_request uuid, p_approve boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.studies_change_requests;
  v_me public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review this' using errcode = '42501';
  end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give the student a reason' using errcode = '22023';
  end if;
  select * into v_req from public.studies_change_requests where id = p_request for update;
  if v_req.id is null or v_req.status <> 'pending' then
    raise exception 'This request is no longer pending' using errcode = 'P0001';
  end if;

  update public.studies_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer_id = auth.uid(), decision_reason = nullif(btrim(p_reason), ''), decided_at = now()
   where id = p_request;

  if p_approve then
    select * into v_me from public.profiles where id = v_req.user_id for update;
    update public.profiles
       set department_id = v_req.department_id, program_id = v_req.program_id,
           batch_year = v_req.batch_year, semester = v_req.semester, section = v_req.section,
           shift = v_req.shift, studies_changed_at = now()
     where id = v_me.id;
    -- The old batch chat goes if they moved batch; the old section chat goes either way.
    delete from public.conversation_members m using public.conversations c
    where c.id = m.conversation_id and m.user_id = v_me.id and c.kind = 'batch'
      and (c.batch_key like 'section:%'
           or (v_me.department_id, v_me.batch_year)
              is distinct from (v_req.department_id, v_req.batch_year));
    perform public.audit('profile.studies_changed', 'profile', v_me.id,
      jsonb_build_object('department', v_me.department_id, 'batch', v_me.batch_year,
                         'section', v_me.section, 'shift', v_me.shift),
      jsonb_build_object('department', v_req.department_id, 'batch', v_req.batch_year,
                         'section', v_req.section, 'shift', v_req.shift));
    perform public.notify(v_me.id, 'studies.approved', null, 'profile', v_me.id);
  else
    perform public.audit('profile.studies_rejected', 'profile', v_req.user_id);
    perform public.notify(v_req.user_id, 'studies.rejected', null, 'profile', v_req.user_id,
      jsonb_build_object('reason', btrim(p_reason)));
  end if;
end;
$$;

-- Section chats follow your section, so nobody can pass through them during setup,
-- when the choice is still free.
create or replace function public.join_batch_chat(p_scope text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_key text;
  v_title text;
  v_code text;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.onboarding_step < 4 then
    raise exception 'Finish setting up your profile first' using errcode = '22023';
  end if;
  select short_code into v_code from public.departments where id = v_me.department_id;
  if v_code is null or v_me.batch_year is null then
    raise exception 'Add your department and session first' using errcode = '22023';
  end if;
  if p_scope = 'batch' then
    v_key := format('batch:%s:%s', v_me.department_id, v_me.batch_year);
    v_title := format('%s %s', v_code, v_me.batch_year);
  elsif p_scope = 'section' and v_me.section is not null then
    v_key := format('section:%s:%s:%s:%s', v_me.department_id, v_me.batch_year, v_me.section,
                    coalesce(v_me.shift::text, '-'));
    v_title := format('%s %s · Sec %s', v_code, v_me.batch_year, v_me.section)
      || coalesce(' · ' || initcap(v_me.shift::text), '');
  else
    raise exception 'Add your section first' using errcode = '22023';
  end if;

  insert into public.conversations (kind, university_id, title, batch_key, created_by)
  values ('batch', v_me.university_id, v_title, v_key, v_me.id)
  on conflict (batch_key) do nothing;
  select id into v_id from public.conversations where batch_key = v_key;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_id, v_me.id, now())
  on conflict do nothing;
  return v_id;
end;
$$;

-- Proof shares the verification bucket, so the daily purge has to keep these files too.
create or replace function public.expired_verification_documents(
  p_days int default 30,
  p_limit int default 500
) returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'verification-docs'
    and o.created_at < now() - make_interval(days => p_days)
    -- Keep a file while its request is open, or until it was decided p_days ago. Everything
    -- else (decided long ago, replaced by a resubmission, never submitted) is due.
    and not exists (
      select 1 from public.verification_requests r
      where r.doc_path = o.name
        and (r.status in ('pending', 'needs_info')
             or r.decided_at > now() - make_interval(days => p_days))
    )
    and not exists (
      select 1 from public.studies_change_requests r
      where r.doc_path = o.name
        and (r.status = 'pending' or r.decided_at > now() - make_interval(days => p_days))
    )
  order by o.created_at
  limit p_limit;
$$;

revoke execute on function
  public.request_studies_change(uuid, uuid, int, int, text, public.shift_type, text),
  public.decide_studies_change(uuid, boolean, text)
  from public, anon;
grant execute on function
  public.request_studies_change(uuid, uuid, int, int, text, public.shift_type, text),
  public.decide_studies_change(uuid, boolean, text)
  to authenticated;
