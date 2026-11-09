-- Messaging someone whose chat you deleted returned that chat's id, but the chat stayed hidden
-- from you until a new message arrived, so the screen said "not found" and you could never
-- write first. Choosing to message them now brings it back, for you only.
create or replace function public.start_dm(p_target uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
  v_connected boolean;
  v_allowed public.visibility_level;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target = v_me or public.blocked_between(v_me, p_target)
     or not public.can_view_profile(p_target) then
    raise exception 'You can''t message this student' using errcode = '42501';
  end if;

  select id into v_id from public.conversations where dm_key = public.dm_key(v_me, p_target);
  if v_id is null then
    v_connected := public.are_connected(v_me, p_target);
    select allow_dms_from into v_allowed from public.privacy_settings where user_id = p_target;
    if not v_connected and not public.visible_at(p_target, coalesce(v_allowed, 'everyone')) then
      raise exception 'This student only takes messages from %',
        case v_allowed when 'connections' then 'connections' when 'nobody' then 'nobody'
                       else 'some students' end
        using errcode = '42501';
    end if;

    insert into public.conversations (kind, university_id, dm_key, created_by)
    values ('dm', public.my_university_id(), public.dm_key(v_me, p_target), v_me)
    on conflict (dm_key) do nothing
    returning id into v_id;
    if v_id is not null then
      insert into public.conversation_members (conversation_id, user_id, role, accepted_at)
      values (v_id, v_me, 'member', now()),
             (v_id, p_target, 'member', case when v_connected then now() end);
      return v_id;
    end if;
    -- Someone else created it a moment ago.
    select id into v_id from public.conversations where dm_key = public.dm_key(v_me, p_target);
  end if;

  update public.conversation_members set hidden_at = null
  where conversation_id = v_id and user_id = v_me and hidden_at is not null;
  return v_id;
end;
$$;
