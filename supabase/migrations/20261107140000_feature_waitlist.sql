-- "Notify me" for features that aren't live yet (AIBuddy first). Students join or leave a
-- feature's waitlist; once the feature is live an admin announces it, which sends each
-- waiting student one in-app notification (and a push where they have it on) exactly once.

create table public.feature_waitlist (
  user_id uuid not null references public.profiles on delete cascade,
  feature text not null check (feature in ('aibuddy')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (user_id, feature)
);
alter table public.feature_waitlist enable row level security;
-- Students read their own rows (to show "You're on the list"); writes go through the
-- functions below.
create policy feature_waitlist_own on public.feature_waitlist for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.feature_waitlist from anon, authenticated;
grant select on public.feature_waitlist to authenticated;
grant all on public.feature_waitlist to service_role;

-- Join (true) or leave (false) a feature's waitlist. Returns whether you're on it.
create or replace function public.set_waitlist(p_feature text, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Log in first' using errcode = '42501';
  end if;
  if p_feature not in ('aibuddy') then
    raise exception 'Unknown feature' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.feature_waitlist (user_id, feature) values (auth.uid(), p_feature)
    on conflict do nothing;
  else
    delete from public.feature_waitlist where user_id = auth.uid() and feature = p_feature;
  end if;
  return p_on;
end;
$$;

-- How many are waiting and not yet told (for the admin's button).
create or replace function public.waitlist_pending(p_feature text) returns int
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then
    (select count(*)::int from public.feature_waitlist w
     join public.profiles p on p.id = w.user_id
     where w.feature = p_feature and w.notified_at is null
       and p.banned_at is null and p.deleted_at is null)
  end;
$$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live'
));

-- Admins only: tell everyone still waiting that the feature is live. Each student is told
-- once; running it again only reaches people who joined since. Returns how many were told.
create or replace function public.announce_feature(p_feature text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_feature not in ('aibuddy') then
    raise exception 'Unknown feature' using errcode = 'P0002';
  end if;
  with told as (
    update public.feature_waitlist w set notified_at = now()
    from public.profiles p
    where w.feature = p_feature and w.notified_at is null
      and p.id = w.user_id and p.banned_at is null and p.deleted_at is null
    returning w.user_id
  ), sent as (
    insert into public.notifications (user_id, type, entity_type, payload)
    select user_id, 'feature.live', 'feature', jsonb_build_object('feature', p_feature)
    from told
    returning 1
  )
  select count(*)::int into v_count from sent;
  perform public.audit('feature.announce', 'feature', null, null,
    jsonb_build_object('feature', p_feature, 'told', v_count));
  return v_count;
end;
$$;

revoke execute on function public.set_waitlist(text, boolean), public.waitlist_pending(text),
  public.announce_feature(text) from public, anon;
grant execute on function public.set_waitlist(text, boolean), public.waitlist_pending(text),
  public.announce_feature(text) to authenticated;
