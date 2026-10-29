-- Replace the caller's interests in one transaction (setup screen 8 and profile edits).
create or replace function public.set_my_interests(p_interest_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_interest_ids), 0) > 10 then
    raise exception 'Pick up to 10 interests' using errcode = '22023';
  end if;

  -- Runs as the caller, so RLS still applies to both statements.
  delete from public.profile_interests where user_id = auth.uid();
  insert into public.profile_interests (user_id, interest_id)
  select auth.uid(), i.id from public.interests i where i.id = any(p_interest_ids);
end;
$$;

revoke execute on function public.set_my_interests(uuid[]) from public, anon;
grant execute on function public.set_my_interests(uuid[]) to authenticated;
