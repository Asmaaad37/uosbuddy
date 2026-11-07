-- Feature #21: mutual connections on profiles ("Ali, Sara and 3 others you know").
--
-- Privacy: always for the caller (auth.uid()), never for an arbitrary pair, so nobody can
-- probe who two other students know. Nothing comes back unless the caller may see the
-- other student's profile, and only mutuals the caller may see themselves are counted
-- (visible_at already drops blocked, banned, deleted and other-university profiles).

create or replace function public.mutual_connections(p_other uuid)
returns table (user_id uuid, full_name text, handle text, avatar_url text, total int)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  allowed as (
    select 1
    from public.profiles t
    join public.privacy_settings s on s.user_id = t.id, me
    where t.id = p_other and p_other <> me.id
      and public.visible_at(t.id, s.profile_visibility)
  ),
  mine as (
    select case when c.requester_id = me.id then c.addressee_id else c.requester_id end as uid
    from public.connections c, me
    where c.status = 'accepted' and (c.requester_id = me.id or c.addressee_id = me.id)
  ),
  theirs as (
    select case when c.requester_id = p_other then c.addressee_id else c.requester_id end as uid
    from public.connections c
    where c.status = 'accepted' and (c.requester_id = p_other or c.addressee_id = p_other)
  ),
  mutual as (
    select p.id, p.full_name, p.handle::text as handle, public.shown_avatar(p.id) as avatar_url
    from mine
    join theirs on theirs.uid = mine.uid
    join public.profiles p on p.id = mine.uid
    join public.privacy_settings s on s.user_id = p.id
    where exists (select 1 from allowed)
      and public.visible_at(p.id, s.profile_visibility)
  )
  select m.id, m.full_name, m.handle, m.avatar_url, (count(*) over ())::int
  from mutual m
  order by m.full_name nulls last
  limit 3;
$$;
revoke execute on function public.mutual_connections(uuid) from public, anon;
grant execute on function public.mutual_connections(uuid) to authenticated;
