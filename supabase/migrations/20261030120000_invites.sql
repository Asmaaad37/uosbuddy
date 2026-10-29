-- Phase 3 task 6: invite links. Each student has one code (/i/{code}); a visitor who
-- signs up from it and finishes setup counts once towards the inviter.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  inviter_id uuid not null unique references public.profiles on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  uses int not null default 0
);

create table public.invite_redemptions (
  user_id uuid primary key references public.profiles on delete cascade,
  invite_id uuid not null references public.invites on delete cascade,
  created_at timestamptz not null default now()
);
create index invite_redemptions_invite_idx on public.invite_redemptions (invite_id);

alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;
create policy invites_own on public.invites for select to authenticated
  using (inviter_id = (select auth.uid()));
revoke all on public.invites, public.invite_redemptions from anon, authenticated;
grant select on public.invites to authenticated;
grant all on public.invites, public.invite_redemptions to service_role;

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
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (b % 31), 1), '')
      into v_code
      from unnest(extensions.gen_random_bytes(8)) with ordinality as t(b, i);
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

-- What an invite link shows anyone, signed in or not: the inviter's first name and how many
-- of their department batch are here. A count, never names.
create or replace function public.invite_preview(p_code text)
returns table (first_name text, department_code text, batch_year int, batch_count int)
language sql stable security definer set search_path = '' as $$
  select
    split_part(p.full_name, ' ', 1),
    d.short_code,
    p.batch_year,
    (select count(*)::int from public.profiles t
      where t.department_id = p.department_id and t.batch_year = p.batch_year
        and t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
        and t.onboarding_step >= 4)
  from public.invites i
  join public.profiles p on p.id = i.inviter_id
  left join public.departments d on d.id = p.department_id
  where i.code = lower(p_code)
    and p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null;
$$;

-- Counts the caller as joined through `p_code`: once per student, never your own code.
create or replace function public.redeem_invite(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
begin
  select * into v_invite from public.invites where code = lower(p_code);
  if not found or v_invite.inviter_id = auth.uid() or auth.uid() is null then
    return false;
  end if;
  insert into public.invite_redemptions (user_id, invite_id) values (auth.uid(), v_invite.id)
  on conflict (user_id) do nothing;
  if not found then
    return false;
  end if;
  update public.invites set uses = uses + 1 where id = v_invite.id;
  return true;
end;
$$;

revoke execute on function public.my_invite_code() from public, anon;
revoke execute on function public.invite_preview(text) from public;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.my_invite_code() to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
