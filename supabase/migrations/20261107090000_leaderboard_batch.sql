-- Redesign §5.3: Backup heroes read "CS · 2022", so the leaderboard also returns each
-- hero's batch year. A new output column changes the return type, so drop and recreate.

drop function if exists public.backup_leaderboard(boolean);

-- This month (Pakistan time): who resolved the most Backup requests. Department or all UoS.
create function public.backup_leaderboard(p_department_only boolean default false)
returns table (rank int, user_id uuid, full_name text, handle text, avatar_url text,
               department text, helped int, batch_year int)
language sql stable security definer set search_path = '' as $$
  with me as (select university_id, department_id from public.profiles where id = auth.uid()),
  month_start as (
    select (date_trunc('month', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi') as at
  ),
  counts as (
    select b.claimed_by as uid, count(*)::int as helped
    from public.backup_requests b, me, month_start m
    where b.status = 'resolved' and b.resolved_at >= m.at and b.university_id = me.university_id
      and b.claimed_by is not null
    group by b.claimed_by
  )
  select (rank() over (order by c.helped desc))::int, p.id, p.full_name, p.handle::text,
         public.shown_avatar(p.id), d.short_code, c.helped, p.batch_year::int
  from counts c
  join public.profiles p on p.id = c.uid
  left join public.departments d on d.id = p.department_id, me
  where public.is_verified() and p.deleted_at is null and p.banned_at is null
    and (not p_department_only or p.department_id = me.department_id)
    and not public.blocked_with(p.id)
  order by c.helped desc, p.full_name
  limit 20;
$$;

revoke execute on function public.backup_leaderboard(boolean) from public, anon;
grant execute on function public.backup_leaderboard(boolean) to authenticated;
