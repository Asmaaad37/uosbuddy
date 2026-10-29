-- my_invite_code() called unnest() on bytea, which Postgres doesn't support, so every
-- first call failed. Read the random bytes with get_byte() instead.
-- The caller's invite code, created on first use. Verified students only.
create or replace function public.my_invite_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not public.is_verified() then
    raise exception 'Only verified students can invite' using errcode = '42501';
  end if;
  select code into v_code from public.invites where inviter_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;
  loop
    -- 8 characters from a 31-character alphabet without look-alikes (0/o, 1/l).
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + get_byte(r.b, i) % 31, 1), '')
      into v_code
      from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
    begin
      insert into public.invites (inviter_id, code) values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      -- Another tab created ours first, or a rare code clash: read ours or try again.
      select code into v_code from public.invites where inviter_id = auth.uid();
      if v_code is not null then
        return v_code;
      end if;
    end;
  end loop;
end;
$$;
