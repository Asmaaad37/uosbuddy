-- C1, C3, C4 from the engineering review.
--   C1: a claimed Backup request no longer stays claimed forever; it expires 72 hours after it
--       was claimed and both people are told.
--   C3: recurring rides end on a date; a cancelled or finished ride's chat closes; leaving a
--       ride's chat gives up your seat.
--   C4: group owners and admins can rename their group, add connections and remove people;
--       a group whose owner leaves gets a new owner.

-- ===========================================================================
-- C1: claimed Backup requests expire.
-- ===========================================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'backup.expired',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test',
  'studies.approved', 'studies.rejected'
));

-- Open requests expire at their own time (unchanged). Claimed ones expire 72 hours after the
-- claim if nobody marks them done: both people are told, and the chat stays readable for
-- another 72 hours like a finished request's. Expired pings and temporary chats are cleared
-- as before.
drop function if exists public.backup_housekeeping();
create function public.backup_housekeeping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
begin
  update public.backup_requests set status = 'expired', closed_at = now()
  where status = 'open' and expires_at < now();

  for v_req in
    update public.backup_requests set status = 'expired', closed_at = now()
    where status = 'claimed' and claimed_at < now() - interval '72 hours'
    returning *
  loop
    update public.conversations set expires_at = now() + interval '72 hours'
    where id = v_req.conversation_id;
    perform public.notify(v_req.requester_id, 'backup.expired', v_req.claimed_by, 'backup',
                          v_req.id, jsonb_build_object('title', v_req.title, 'mine', true));
    perform public.notify(v_req.claimed_by, 'backup.expired', v_req.requester_id, 'backup',
                          v_req.id, jsonb_build_object('title', v_req.title, 'mine', false));
  end loop;

  delete from public.conversations where kind = 'backup_temp' and expires_at < now();
  delete from public.conversations where kind = 'ping' and expires_at < now() - interval '1 day';
end;
$$;
revoke execute on function public.backup_housekeeping() from public, anon, authenticated;

-- ===========================================================================
-- C3: rides.
-- ===========================================================================
-- The last day a recurring ride runs (Pakistan time); empty for a one-off ride.
alter table public.rides add column recurring_until date;
update public.rides
   set recurring_until = (depart_at at time zone 'Asia/Karachi')::date + 56
 where cardinality(recurring_days) > 0;
alter table public.rides add constraint rides_recurring_until_check
  check ((cardinality(recurring_days) = 0) = (recurring_until is null));

-- Today in Pakistan, for comparing with recurring_until.
create or replace function public.pk_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Karachi')::date;
$$;

drop function if exists public.create_ride(text, text, text, timestamptz, int, smallint[], boolean, text);
create function public.create_ride(
  p_kind text, p_from text, p_to text, p_depart timestamptz, p_seats int default 1,
  p_recurring smallint[] default '{}', p_women_only boolean default false, p_notes text default null,
  p_until date default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
  v_days smallint[] := coalesce(p_recurring, '{}');
  v_start date := (p_depart at time zone 'Asia/Karachi')::date;
  v_until date;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_women_only and not public.women_eligible() then
    raise exception 'Women-only rides are for students confirmed for women-only spaces'
      using errcode = '42501';
  end if;
  if p_depart < now() or p_depart > now() + interval '60 days' then
    raise exception 'Pick a time in the next 60 days' using errcode = '22023';
  end if;
  if cardinality(v_days) > 0 then
    v_until := coalesce(p_until, v_start + 56);
    if v_until < v_start or v_until > v_start + 120 then
      raise exception 'Pick an end date within 4 months of the first ride' using errcode = '22023';
    end if;
  end if;
  if (select count(*) from public.rides
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 rides today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.rides (university_id, user_id, kind, from_area, to_area, depart_at,
                            recurring_days, recurring_until, seats, women_only, notes)
  values (public.my_university_id(), auth.uid(), p_kind, trim(p_from), trim(p_to), p_depart,
          v_days, v_until, coalesce(p_seats, 1), coalesce(p_women_only, false),
          nullif(trim(p_notes), ''))
  returning id into v_id;
  return v_id;
end;
$fn$;

-- Is the ride still running? One-off: until it leaves. Recurring: until its last day.
create or replace function public.ride_running(p_ride public.rides) returns boolean
language sql stable set search_path = '' as $$
  select case when cardinality(p_ride.recurring_days) = 0 then p_ride.depart_at >= now()
              else p_ride.recurring_until >= public.pk_today() end;
$$;

create or replace function public.request_seat(p_ride uuid, p_message text default null) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_ride public.rides;
  v_prev text;
begin
  select * into v_ride from public.rides where id = p_ride;
  if not found or not public.can_see_ride(v_ride) then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;
  if v_ride.user_id = auth.uid() then
    raise exception 'This is your own ride' using errcode = '22023';
  end if;
  if v_ride.status <> 'open' or not public.ride_running(v_ride) then
    raise exception 'This ride isn''t taking requests' using errcode = '22023';
  end if;
  if (select count(*) from public.ride_requests
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s 20 ride requests today.' using errcode = '54000';
  end if;
  select status into v_prev from public.ride_requests where ride_id = p_ride and user_id = auth.uid();
  if v_prev = 'declined' then
    raise exception 'The rider already said no to this one' using errcode = '22023';
  end if;
  if v_prev in ('pending', 'accepted') then
    return;
  end if;
  insert into public.ride_requests (ride_id, user_id, message)
  values (p_ride, auth.uid(), nullif(trim(p_message), ''))
  on conflict (ride_id, user_id) do update
    set status = 'pending', message = excluded.message, created_at = now();
  perform public.notify(v_ride.user_id, 'ride.request', auth.uid(), 'ride', p_ride,
    jsonb_build_object('from', v_ride.from_area, 'to', v_ride.to_area, 'kind', v_ride.kind));
end;
$fn$;

-- Cancelling a ride now also closes its chat: everyone can still read it, nobody can send.
create or replace function public.cancel_ride(p_ride uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_ride public.rides;
  v_rider uuid;
begin
  select * into v_ride from public.rides
  where id = p_ride and user_id = auth.uid() and status <> 'cancelled' for update;
  if not found then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;
  update public.rides set status = 'cancelled' where id = p_ride;
  update public.conversations set expires_at = now()
  where id = v_ride.conversation_id and (expires_at is null or expires_at > now());
  for v_rider in
    select user_id from public.ride_requests where ride_id = p_ride and status in ('pending', 'accepted')
  loop
    perform public.notify(v_rider, 'ride.cancelled', auth.uid(), 'ride', p_ride,
      jsonb_build_object('from', v_ride.from_area, 'to', v_ride.to_area));
  end loop;
  update public.ride_requests set status = 'cancelled'
  where ride_id = p_ride and status = 'pending';
end;
$fn$;

drop function if exists public.rides_board(text, boolean);
create function public.rides_board(p_kind text default null, p_mine boolean default false)
returns table (id uuid, kind text, from_area text, to_area text, depart_at timestamptz,
               recurring_days smallint[], recurring_until date, seats int, seats_taken int,
               women_only boolean, notes text, status text, conversation_id uuid, user_id uuid,
               handle text, full_name text, avatar_url text, my_request text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.from_area, r.to_area, r.depart_at, r.recurring_days, r.recurring_until,
    r.seats,
    (select count(*)::int from public.ride_requests q where q.ride_id = r.id and q.status = 'accepted'),
    r.women_only, r.notes, r.status,
    case when r.user_id = auth.uid()
           or exists (select 1 from public.ride_requests q
                      where q.ride_id = r.id and q.user_id = auth.uid() and q.status = 'accepted')
         then r.conversation_id end,
    r.user_id, p.handle::text, p.full_name, public.shown_avatar(p.id),
    (select q.status from public.ride_requests q where q.ride_id = r.id and q.user_id = auth.uid())
  from public.rides r
  join public.profiles p on p.id = r.user_id
  where public.can_see_ride(r)
    and (p_kind is null or r.kind = p_kind)
    and case when p_mine
          then r.user_id = auth.uid()
               or exists (select 1 from public.ride_requests q
                          where q.ride_id = r.id and q.user_id = auth.uid()
                            and q.status in ('pending', 'accepted'))
          else r.status <> 'cancelled'
               and case when cardinality(r.recurring_days) = 0
                        then r.depart_at > now() - interval '1 hour'
                        else r.recurring_until >= public.pk_today() end
        end
  order by r.depart_at
  limit 100;
$$;

-- A ride's chat closes a day after a one-off ride leaves, or a day after a recurring ride's
-- last day.
create or replace function public.rides_housekeeping() returns void
language sql security definer set search_path = '' as $$
  update public.conversations c set expires_at = now()
  from public.rides r
  where r.conversation_id = c.id and c.expires_at is null
    and case when cardinality(r.recurring_days) = 0
             then r.depart_at < now() - interval '1 day'
             else r.recurring_until < public.pk_today() - 1 end;
$$;
select cron.schedule('rides-housekeeping', '25 * * * *', 'select public.rides_housekeeping()');

-- ===========================================================================
-- C4: managing a group. Only groups people made themselves: study groups (joined through the
-- course) and ride chats (tied to seats) keep their own rules.
-- ===========================================================================
create or replace function public.is_custom_group(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation and c.kind = 'group' and c.course_id is null
      and not exists (select 1 from public.rides r where r.conversation_id = c.id)
      and not exists (select 1 from public.study_groups g where g.conversation_id = c.id)
  );
$$;

-- The caller's role in a conversation, or null.
create or replace function public.my_role_in(p_conversation uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.conversation_members
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_members uuid[] := array(select distinct x from unnest(p_members) x where x <> auth.uid());
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not public.is_custom_group(p_conversation)
     or coalesce(public.my_role_in(p_conversation), '') not in ('owner', 'admin') then
    raise exception 'Only group admins can add people' using errcode = '42501';
  end if;
  if cardinality(v_members) = 0 then
    raise exception 'Pick at least one person' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_members) x where not public.are_connected(auth.uid(), x)) then
    raise exception 'You can only add your connections' using errcode = '42501';
  end if;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  select p_conversation, x, now() from unnest(v_members) x
  on conflict do nothing;
  if (select count(*) from public.conversation_members where conversation_id = p_conversation) > 50 then
    raise exception 'Groups hold up to 50 people' using errcode = '22023';
  end if;
end;
$$;

-- The owner can remove anyone; an admin can remove members (not the owner or other admins).
create or replace function public.remove_group_member(p_conversation uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_mine text := public.my_role_in(p_conversation);
  v_theirs text;
begin
  if not public.is_custom_group(p_conversation) or coalesce(v_mine, '') not in ('owner', 'admin') then
    raise exception 'Only group admins can remove people' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Use Leave to leave the group' using errcode = '22023';
  end if;
  select role into v_theirs from public.conversation_members
  where conversation_id = p_conversation and user_id = p_user;
  if not found then
    raise exception 'They''re not in this group' using errcode = 'P0002';
  end if;
  if v_theirs = 'owner' or (v_theirs = 'admin' and v_mine <> 'owner') then
    raise exception 'Only the owner can remove an admin' using errcode = '42501';
  end if;
  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = p_user;
end;
$$;

create or replace function public.rename_group(p_conversation uuid, p_title text, p_emoji text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_custom_group(p_conversation)
     or coalesce(public.my_role_in(p_conversation), '') not in ('owner', 'admin') then
    raise exception 'Only group admins can rename the group' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'Give the group a name' using errcode = '22023';
  end if;
  if char_length(coalesce(p_emoji, '')) > 8 then
    raise exception 'Pick one emoji' using errcode = '22023';
  end if;
  update public.conversations
     set title = trim(p_title), emoji = nullif(trim(p_emoji), '')
   where id = p_conversation;
end;
$$;

-- Leaving. A ride's chat: a rider gives up their seat; the ride's poster cancels the ride
-- instead. A group whose owner leaves passes to its longest-standing admin, else member.
drop function if exists public.leave_conversation(uuid);
create function public.leave_conversation(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.conversation_kind;
  v_role text := public.my_role_in(p_conversation);
  v_ride public.rides;
begin
  select kind into v_kind from public.conversations where id = p_conversation;
  if v_role is null or v_kind not in ('group', 'batch', 'course') then
    return;
  end if;

  select * into v_ride from public.rides where conversation_id = p_conversation;
  if found then
    if v_ride.user_id = auth.uid() then
      raise exception 'This is your ride. Cancel it from Rides instead.' using errcode = '22023';
    end if;
    if v_ride.status <> 'cancelled' and exists (
         select 1 from public.ride_requests
         where ride_id = v_ride.id and user_id = auth.uid() and status = 'accepted') then
      perform public.cancel_seat(v_ride.id);  -- frees the seat, leaves the chat, tells the poster
      return;
    end if;
  end if;

  delete from public.conversation_members
  where conversation_id = p_conversation and user_id = auth.uid();

  if v_role = 'owner' then
    update public.conversation_members m set role = 'owner'
    where m.conversation_id = p_conversation
      and m.user_id = (select user_id from public.conversation_members
                       where conversation_id = p_conversation
                       order by (role = 'admin') desc, joined_at, user_id
                       limit 1);
  end if;
end;
$$;

-- ===========================================================================
-- Grants.
-- ===========================================================================
revoke execute on function public.ride_running(public.rides), public.rides_housekeeping(),
  public.is_custom_group(uuid), public.my_role_in(uuid)
  from public, anon, authenticated;
revoke execute on function public.pk_today(),
  public.create_ride(text, text, text, timestamptz, int, smallint[], boolean, text, date),
  public.request_seat(uuid, text), public.cancel_ride(uuid), public.rides_board(text, boolean),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid),
  public.rename_group(uuid, text, text), public.leave_conversation(uuid)
  from public, anon;
grant execute on function public.pk_today(),
  public.create_ride(text, text, text, timestamptz, int, smallint[], boolean, text, date),
  public.request_seat(uuid, text), public.cancel_ride(uuid), public.rides_board(text, boolean),
  public.add_group_members(uuid, uuid[]), public.remove_group_member(uuid, uuid),
  public.rename_group(uuid, text, text), public.leave_conversation(uuid)
  to authenticated;
