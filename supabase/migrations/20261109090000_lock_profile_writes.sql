-- Students could update every column of their own profile through the API, skipping the
-- app's checks: any department or batch (which privacy levels, feeds and batch chats trust),
-- reserved handles, any display name. Now nobody writes profiles directly; these functions
-- are the only way in, and the rules live here rather than only in the app.
--
-- Department and session are self-declared, so once setup is finished a student can change
-- them once (to fix a mistake). After that an admin has to allow it. Every such change is
-- in the audit log. The display name isn't editable here at all.

revoke update on public.profiles from authenticated;
drop policy if exists profiles_update_self on public.profiles;

-- This trigger locks the student's profile row, and locking needs UPDATE when run as them.
alter function public.limit_profile_interests() security definer;

alter table public.profiles add column studies_changed_at timestamptz;

-- Mirrors lib/validation/handle.ts, which gives the instant feedback in the form.
create or replace function public.handle_allowed(p_handle text) returns boolean
language sql immutable set search_path = '' as $$
  select p_handle ~ '^[A-Za-z0-9_]{3,20}$'
    and replace(lower(p_handle), '_', '') <> all (array[
      'admin', 'administrator', 'uosbuddy', 'uos', 'support', 'help', 'official', 'moderator',
      'mod', 'staff', 'team', 'root', 'system', 'api', 'auth', 'login', 'setup', 'explore',
      'settings', 'me', 'null', 'undefined', 'sargodha', 'university'])
    and not exists (
      select 1 from unnest(array[
        'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'porn', 'chutiya', 'chutya', 'harami',
        'haramzad', 'bhenchod', 'behenchod', 'benchod', 'madarchod', 'maderchod', 'gandu',
        'randi', 'kanjar']) w
      where position(w in lower(p_handle)) > 0);
$$;

-- Setup step 1, and Me → Studies.
create or replace function public.save_my_academic(
  p_department uuid, p_program uuid, p_batch int, p_semester int, p_section text,
  p_shift public.shift_type
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_semesters int;
  v_moved boolean;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid() for update;

  select duration_semesters into v_semesters from public.programs where id = p_program;
  if v_semesters is null then
    raise exception 'Choose your program' using errcode = '22023';
  end if;
  if p_semester not between 1 and v_semesters then
    raise exception 'That program has % semesters.', v_semesters using errcode = '22023';
  end if;

  v_moved := v_me.onboarding_step >= 4
    and (v_me.department_id, v_me.batch_year) is distinct from (p_department, p_batch);
  if v_moved and v_me.studies_changed_at is not null then
    raise exception 'You''ve already changed your department or session once. Ask an admin to change it.'
      using errcode = '42501';
  end if;

  update public.profiles
     set department_id = p_department, program_id = p_program, batch_year = p_batch,
         semester = p_semester, section = nullif(trim(p_section), ''), shift = p_shift,
         studies_changed_at = case when v_moved then now() else studies_changed_at end,
         onboarding_step = greatest(onboarding_step, 1)
   where id = v_me.id;

  if v_moved then
    -- The old batch and section chats aren't theirs any more.
    delete from public.conversation_members m using public.conversations c
    where c.id = m.conversation_id and m.user_id = v_me.id and c.kind = 'batch';
    perform public.audit('profile.studies_changed', 'profile', v_me.id,
      jsonb_build_object('department', v_me.department_id, 'batch', v_me.batch_year),
      jsonb_build_object('department', p_department, 'batch', p_batch));
  end if;
end;
$$;

-- Setup step 2, and Me → Photo, handle and bio.
create or replace function public.save_my_about(
  p_handle text, p_bio text, p_hometown text, p_residence public.residence_type,
  p_avatar_url text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid() for update;
  if v_me.onboarding_step < 1 then
    raise exception 'Finish the earlier steps first' using errcode = '22023';
  end if;
  -- A handle you already have stays yours, even if the rules changed since.
  if p_handle is distinct from v_me.handle::text and not public.handle_allowed(p_handle) then
    raise exception 'Pick a different handle' using errcode = '22023';
  end if;
  if p_avatar_url is not null and p_avatar_url !~
     ('^https?://[^/]+/storage/v1/object/public/avatars/' || v_me.id::text || '/[^/]+$') then
    raise exception 'Upload your photo again.' using errcode = '22023';
  end if;
  update public.profiles
     set handle = p_handle, bio = nullif(trim(p_bio), ''),
         hometown_city = nullif(trim(p_hometown), ''), residence = p_residence,
         avatar_url = p_avatar_url, onboarding_step = greatest(onboarding_step, 2)
   where id = v_me.id;
end;
$$;

-- Setup step 3 (the interests themselves go through set_my_interests).
create or replace function public.save_my_opening_move(p_prompt text, p_answer text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  update public.profiles
     set opening_move_prompt = nullif(trim(p_prompt), ''),
         opening_move = case when nullif(trim(p_prompt), '') is null then null
                             else nullif(trim(p_answer), '') end,
         onboarding_step = greatest(onboarding_step, 3)
   where id = auth.uid() and onboarding_step >= 2;
  if not found then
    raise exception 'Finish the earlier steps first' using errcode = '22023';
  end if;
end;
$$;

-- Setup step 4: nobody reaches the directory without a handle and a department.
create or replace function public.finish_setup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  update public.profiles set onboarding_step = greatest(onboarding_step, 4)
  where id = auth.uid()
    and (onboarding_step >= 4 or (onboarding_step >= 3 and handle is not null and department_id is not null));
  if not found then
    raise exception 'Finish the earlier steps first' using errcode = '22023';
  end if;
end;
$$;

-- Admin → People: let a student correct their department or session one more time.
create or replace function public.allow_studies_change(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.profiles set studies_changed_at = null where id = p_user;
  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  perform public.audit('profile.studies_unlocked', 'profile', p_user);
end;
$$;

revoke execute on function public.handle_allowed(text) from public, anon, authenticated;
revoke execute on function
  public.save_my_academic(uuid, uuid, int, int, text, public.shift_type),
  public.save_my_about(text, text, text, public.residence_type, text),
  public.save_my_opening_move(text, text), public.finish_setup(),
  public.allow_studies_change(uuid)
  from public, anon;
grant execute on function
  public.save_my_academic(uuid, uuid, int, int, text, public.shift_type),
  public.save_my_about(text, text, text, public.residence_type, text),
  public.save_my_opening_move(text, text), public.finish_setup(),
  public.allow_studies_change(uuid)
  to authenticated;
