-- Phase 8: campus life. Rides (with admin-confirmed women-only access), the market and
-- lost-and-found, and societies with events. As before, students write only through
-- security-definer functions; RLS grants reads.

-- A student's photo, if the caller may see it.
create or replace function public.shown_avatar(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end
  from public.profiles p join public.privacy_settings s on s.user_id = p.id
  where p.id = p_user;
$$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only'
));

-- ===========================================================================
-- Women-only access: a student asks, an admin confirms (project owner's choice).
-- ===========================================================================
create table public.women_only_access (
  user_id uuid primary key references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text check (char_length(note) <= 200),
  decided_by uuid references public.profiles on delete set null,
  decided_at timestamptz
);
alter table public.women_only_access enable row level security;
create policy women_only_access_own on public.women_only_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.women_only_access from anon, authenticated;
grant select on public.women_only_access to authenticated;
grant all on public.women_only_access to service_role;

create or replace function public.women_eligible() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.women_only_access
                 where user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.request_women_only(p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  insert into public.women_only_access (user_id, note)
  values (auth.uid(), nullif(trim(p_note), ''))
  on conflict (user_id) do update
    set status = 'pending', note = excluded.note, created_at = now(), decided_by = null, decided_at = null
    where public.women_only_access.status = 'rejected'
      and public.women_only_access.decided_at < now() - interval '7 days';
end;
$$;

create or replace function public.decide_women_only(p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.women_only_access
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where user_id = p_user;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  perform public.notify(p_user, 'access.women_only', null, null, null,
                        jsonb_build_object('approved', p_approve));
end;
$$;

-- The admin queue: who's waiting, oldest first.
create or replace function public.women_only_queue()
returns table (user_id uuid, created_at timestamptz, note text, full_name text, handle text,
               avatar_url text, department text, batch_year int)
language sql stable security definer set search_path = '' as $$
  select w.user_id, w.created_at, w.note, p.full_name, p.handle::text, p.avatar_url,
         d.name, p.batch_year
  from public.women_only_access w
  join public.profiles p on p.id = w.user_id
  left join public.departments d on d.id = p.department_id
  where w.status = 'pending' and public.is_admin()
  order by w.created_at;
$$;

-- ===========================================================================
-- Rides: offer a lift or ask for one; the owner accepts seats; accepted riders share a chat.
-- ===========================================================================
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('offer', 'request')),
  from_area text not null check (char_length(from_area) between 2 and 60),
  to_area text not null check (char_length(to_area) between 2 and 60),
  depart_at timestamptz not null,
  -- 0 = Monday … 6 = Sunday; empty for a one-off ride.
  recurring_days smallint[] not null default '{}'
    check (recurring_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  seats smallint not null default 1 check (seats between 1 and 8),
  women_only boolean not null default false,
  notes text check (char_length(notes) <= 300),
  status text not null default 'open' check (status in ('open', 'full', 'cancelled')),
  conversation_id uuid references public.conversations on delete set null,
  check (lower(from_area) <> lower(to_area))
);
create index rides_board_idx on public.rides (university_id, status, depart_at);
create index rides_user_idx on public.rides (user_id, created_at desc);
alter table public.rides enable row level security;
-- Women-only rides are invisible to anyone not confirmed (and to nobody else's eyes).
create policy rides_read on public.rides for select to authenticated
  using ((select public.is_verified())
         and university_id = (select public.my_university_id())
         and (not women_only or user_id = (select auth.uid()) or (select public.women_eligible()))
         and not public.blocked_with(user_id));
revoke all on public.rides from anon, authenticated;
grant select on public.rides to authenticated;
grant all on public.rides to service_role;

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ride_id uuid not null references public.rides on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  message text check (char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  unique (ride_id, user_id)
);
create index ride_requests_user_idx on public.ride_requests (user_id, created_at desc);
alter table public.ride_requests enable row level security;
create policy ride_requests_read on public.ride_requests for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.rides r where r.id = ride_id and r.user_id = (select auth.uid())));
revoke all on public.ride_requests from anon, authenticated;
grant select on public.ride_requests to authenticated;
grant all on public.ride_requests to service_role;

-- Can the caller see (and so join) this ride? The same rule as rides_read.
create or replace function public.can_see_ride(p_ride public.rides) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_verified()
     and p_ride.university_id = public.my_university_id()
     and (not p_ride.women_only or p_ride.user_id = auth.uid() or public.women_eligible())
     and not public.blocked_with(p_ride.user_id);
$$;

create or replace function public.create_ride(
  p_kind text, p_from text, p_to text, p_depart timestamptz, p_seats int default 1,
  p_recurring smallint[] default '{}', p_women_only boolean default false, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
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
  if (select count(*) from public.rides
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 rides today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.rides (university_id, user_id, kind, from_area, to_area, depart_at,
                            recurring_days, seats, women_only, notes)
  values (public.my_university_id(), auth.uid(), p_kind, trim(p_from), trim(p_to), p_depart,
          coalesce(p_recurring, '{}'), coalesce(p_seats, 1), coalesce(p_women_only, false),
          nullif(trim(p_notes), ''))
  returning id into v_id;
  return v_id;
end;
$fn$;

-- Ask for a seat (on an offer) or offer a lift (on a request).
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
  if v_ride.status <> 'open'
     or (v_ride.depart_at < now() and cardinality(v_ride.recurring_days) = 0) then
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

-- The ride's owner accepts or declines. Accepting adds both to the ride's group chat.
create or replace function public.respond_seat(p_request uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_req public.ride_requests;
  v_ride public.rides;
  v_conv uuid;
  v_taken int;
begin
  select * into v_req from public.ride_requests where id = p_request;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  select * into v_ride from public.rides where id = v_req.ride_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Already answered' using errcode = '22023';
  end if;

  if not p_accept then
    update public.ride_requests set status = 'declined' where id = p_request;
    perform public.notify(v_req.user_id, 'ride.declined', auth.uid(), 'ride', v_ride.id,
      jsonb_build_object('from', v_ride.from_area, 'to', v_ride.to_area));
    return null;
  end if;

  if v_ride.status <> 'open' then
    raise exception 'This ride is full' using errcode = '22023';
  end if;
  v_conv := v_ride.conversation_id;
  if v_conv is null then
    insert into public.conversations (kind, university_id, title, emoji, created_by)
    values ('group', v_ride.university_id,
            left('Ride: ' || v_ride.from_area || ' → ' || v_ride.to_area, 60), '🚗', auth.uid())
    returning id into v_conv;
    insert into public.conversation_members (conversation_id, user_id, role, accepted_at)
    values (v_conv, auth.uid(), 'owner', now());
    update public.rides set conversation_id = v_conv where id = v_ride.id;
  end if;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_conv, v_req.user_id, now()) on conflict do nothing;
  update public.ride_requests set status = 'accepted' where id = p_request;

  -- An offer fills when its seats are taken; a request needs one lift.
  select count(*) into v_taken from public.ride_requests where ride_id = v_ride.id and status = 'accepted';
  if v_ride.kind = 'request' or v_taken >= v_ride.seats then
    update public.rides set status = 'full' where id = v_ride.id;
  end if;
  perform public.notify(v_req.user_id, 'ride.accepted', auth.uid(), 'conversation', v_conv,
    jsonb_build_object('from', v_ride.from_area, 'to', v_ride.to_area));
  return v_conv;
end;
$fn$;

-- A rider withdraws: their seat frees up and they leave the ride's chat.
create or replace function public.cancel_seat(p_ride uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_req public.ride_requests;
  v_ride public.rides;
begin
  select * into v_req from public.ride_requests
  where ride_id = p_ride and user_id = auth.uid() and status in ('pending', 'accepted');
  if not found then
    raise exception 'Nothing to cancel' using errcode = 'P0002';
  end if;
  select * into v_ride from public.rides where id = p_ride for update;
  update public.ride_requests set status = 'cancelled' where id = v_req.id;
  if v_req.status = 'accepted' then
    delete from public.conversation_members
    where conversation_id = v_ride.conversation_id and user_id = auth.uid();
    if v_ride.status = 'full' then
      update public.rides set status = 'open' where id = p_ride;
    end if;
    perform public.notify(v_ride.user_id, 'ride.left', auth.uid(), 'ride', p_ride,
      jsonb_build_object('from', v_ride.from_area, 'to', v_ride.to_area));
  end if;
end;
$fn$;

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

-- The board: upcoming (or recurring) rides the caller may see, with who posted them.
create or replace function public.rides_board(p_kind text default null, p_mine boolean default false)
returns table (id uuid, kind text, from_area text, to_area text, depart_at timestamptz,
               recurring_days smallint[], seats int, seats_taken int, women_only boolean,
               notes text, status text, conversation_id uuid, user_id uuid, handle text,
               full_name text, avatar_url text, my_request text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.kind, r.from_area, r.to_area, r.depart_at, r.recurring_days, r.seats,
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
               and (r.depart_at > now() - interval '1 hour' or cardinality(r.recurring_days) > 0)
        end
  order by r.depart_at
  limit 100;
$$;

-- Requests on one of the caller's rides.
create or replace function public.ride_requests_for(p_ride uuid)
returns table (id uuid, created_at timestamptz, message text, status text, user_id uuid,
               handle text, full_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select q.id, q.created_at, q.message, q.status, p.id, p.handle::text, p.full_name,
         public.shown_avatar(p.id)
  from public.ride_requests q
  join public.rides r on r.id = q.ride_id
  join public.profiles p on p.id = q.user_id
  where q.ride_id = p_ride and r.user_id = auth.uid() and q.status in ('pending', 'accepted')
  order by q.created_at;
$$;

-- ===========================================================================
-- Market and lost-and-found.
-- ===========================================================================
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('sell', 'buy', 'free', 'lost', 'found')),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  price_pkr int check (price_pkr between 0 and 10000000),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 4),
  location_hint text check (char_length(location_hint) <= 80),
  status text not null default 'active' check (status in ('active', 'done', 'held', 'removed')),
  done_at timestamptz
);
create index listings_board_idx on public.listings (university_id, kind, created_at desc);
create index listings_user_idx on public.listings (user_id, created_at desc);
alter table public.listings enable row level security;
create policy listings_read on public.listings for select to authenticated
  using ((select public.is_verified())
         and university_id = (select public.my_university_id())
         and (status in ('active', 'done') or (status = 'held' and user_id = (select auth.uid())))
         and not public.blocked_with(user_id));
revoke all on public.listings from anon, authenticated;
grant select on public.listings to authenticated;
grant all on public.listings to service_role;

-- The moderation decision covers the title and description together ("title\ndescription").
create or replace function public.create_listing(
  p_kind text, p_title text, p_description text default '', p_price int default null,
  p_media text[] default '{}', p_location text default null,
  p_mod_token text default null, p_mod_status text default 'published'
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
  v_status text;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_media, '{}')) m
             where m !~ '^listings/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)\Z') then
    raise exception 'Upload your photos again' using errcode = '22023';
  end if;
  if p_kind not in ('sell', 'buy') and p_price is not null then
    raise exception 'Only buying and selling have a price' using errcode = '22023';
  end if;
  v_status := public.moderation_status(p_title || E'\n' || coalesce(p_description, ''),
                                       p_mod_token, p_mod_status);
  if (select count(*) from public.listings
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s 10 listings today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.listings (university_id, user_id, kind, title, description, price_pkr,
                               media_paths, location_hint, status)
  values (public.my_university_id(), auth.uid(), p_kind, trim(p_title), trim(coalesce(p_description, '')),
          p_price, coalesce(p_media, '{}'), nullif(trim(p_location), ''),
          case when v_status = 'held' then 'held' else 'active' end)
  returning id into v_id;
  return v_id;
end;
$fn$;

-- "Sold", "Found" or "Returned": the listing stays visible, marked done.
create or replace function public.mark_listing_done(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings set status = 'done', done_at = now()
  where id = p_listing and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_listing(p_listing uuid) returns void
language sql security definer set search_path = '' as $$
  update public.listings set status = 'removed'
  where id = p_listing and user_id = auth.uid() and status <> 'removed';
$$;

create or replace function public.market_listings(
  p_kind text default null, p_query text default null, p_before timestamptz default null,
  p_mine boolean default false
)
returns table (id uuid, created_at timestamptz, kind text, title text, description text,
               price_pkr int, media_paths text[], location_hint text, status text,
               user_id uuid, handle text, full_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.created_at, l.kind, l.title, l.description, l.price_pkr, l.media_paths,
         l.location_hint, l.status, p.id, p.handle::text, p.full_name, public.shown_avatar(p.id)
  from public.listings l
  join public.profiles p on p.id = l.user_id
  where public.is_verified()
    and l.university_id = public.my_university_id()
    and not public.blocked_with(l.user_id)
    and case when p_mine then l.user_id = auth.uid() and l.status <> 'removed'
             else l.status = 'active' or (l.status = 'done' and l.done_at > now() - interval '3 days')
        end
    and (p_kind is null or l.kind = p_kind)
    and (p_query is null or l.title ilike '%' || p_query || '%' or l.description ilike '%' || p_query || '%')
    and (p_before is null or l.created_at < p_before)
  order by l.created_at desc
  limit 30;
$$;

-- Photos: private bucket, random names; verified students can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-media', 'listing-media', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy listing_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media' and (select public.is_verified())
              and name ~ '^listings/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy listing_media_read on storage.objects for select to authenticated
  using (bucket_id = 'listing-media' and (select public.is_verified()));

-- Reports now cover listings, rides and events; 3 reports hold a listing.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'message', 'conversation', 'post', 'comment', 'resource',
                         'listing', 'ride', 'event'));

create or replace function public.reports_hold_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open int;
begin
  if new.target_type not in ('post', 'comment', 'resource', 'listing') then
    return new;
  end if;
  select count(*) into v_open from public.reports
  where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if new.target_type = 'post' then
    update public.posts set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  elsif new.target_type = 'comment' then
    update public.comments set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  elsif new.target_type = 'listing' then
    update public.listings set status = 'held'
    where id = new.target_id and status = 'active' and v_open >= 3;
  else
    update public.resources set status = 'held'
    where id = new.target_id and status = 'published' and v_open >= 3;
  end if;
  return new;
end;
$$;

create or replace function public.report(
  p_target_type text, p_target_id uuid, p_reason text, p_details text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target_type = 'message' and not exists (
    select 1 from public.messages where id = p_target_id and public.is_member(conversation_id)
  ) then
    raise exception 'Message not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'post' and not exists (select 1 from public.posts_public where id = p_target_id) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'comment' and not exists (select 1 from public.comments_public where id = p_target_id) then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'resource' and not exists (
    select 1 from public.resources where id = p_target_id and status = 'published'
  ) then
    raise exception 'File not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'listing' and not exists (select 1 from public.listings where id = p_target_id) then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'ride' and not exists (select 1 from public.rides where id = p_target_id) then
    raise exception 'Ride not found' using errcode = 'P0002';
  end if;
  if p_target_type = 'event' and not exists (select 1 from public.events where id = p_target_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  on conflict do nothing;
end;
$$;

-- ===========================================================================
-- Societies (admin-verified) and events.
-- ===========================================================================
create table public.societies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  name text not null check (char_length(name) between 3 and 80),
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$'),
  description text not null default '' check (char_length(description) <= 1000),
  emoji text check (char_length(emoji) <= 8),
  verified boolean not null default false,
  verified_at timestamptz,
  created_by uuid references public.profiles on delete set null,
  unique (university_id, slug)
);
alter table public.societies enable row level security;
create policy societies_read on public.societies for select to authenticated
  using ((select public.is_verified())
         and university_id = (select public.my_university_id())
         and (verified or created_by = (select auth.uid()) or (select public.is_admin())));
revoke all on public.societies from anon, authenticated;
grant select on public.societies to authenticated;
grant all on public.societies to service_role;

create table public.society_members (
  society_id uuid not null references public.societies on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create index society_members_user_idx on public.society_members (user_id);
alter table public.society_members enable row level security;
create policy society_members_read on public.society_members for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.societies s where s.id = society_id));
revoke all on public.society_members from anon, authenticated;
grant select on public.society_members to authenticated;
grant all on public.society_members to service_role;

create or replace function public.is_society_admin(p_society uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.society_members
                 where society_id = p_society and user_id = auth.uid() and role = 'admin');
$$;

-- A student starts a society page; it's visible to others once an admin verifies it.
create or replace function public.create_society(
  p_name text, p_slug text, p_description text default '', p_emoji text default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if (select count(*) from public.societies
      where created_by = auth.uid() and created_at > now() - interval '1 day') >= 2 then
    raise exception 'That''s 2 societies today.' using errcode = '54000';
  end if;
  if exists (select 1 from public.societies
             where university_id = public.my_university_id() and slug = lower(trim(p_slug))) then
    raise exception 'That web address is taken. Try another.' using errcode = '22023';
  end if;
  insert into public.societies (university_id, name, slug, description, emoji, created_by)
  values (public.my_university_id(), trim(p_name), lower(trim(p_slug)),
          trim(coalesce(p_description, '')), nullif(trim(p_emoji), ''), auth.uid())
  returning id into v_id;
  insert into public.society_members (society_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$fn$;

create or replace function public.verify_society(p_society uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_creator uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.societies
     set verified = p_verified, verified_at = case when p_verified then now() end
   where id = p_society
  returning created_by into v_creator;
  if not found then
    raise exception 'Society not found' using errcode = 'P0002';
  end if;
  if p_verified then
    perform public.notify(v_creator, 'society.verified', null, 'society', p_society, '{}');
  end if;
end;
$$;

create or replace function public.join_society(p_society uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.societies s
                 where s.id = p_society and s.verified and public.is_verified()
                   and s.university_id = public.my_university_id()) then
    raise exception 'Society not found' using errcode = 'P0002';
  end if;
  insert into public.society_members (society_id, user_id) values (p_society, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.leave_society(p_society uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_society_admin(p_society) and (
    select count(*) from public.society_members where society_id = p_society and role = 'admin'
  ) = 1 then
    raise exception 'Make someone else an admin before you leave' using errcode = '22023';
  end if;
  delete from public.society_members where society_id = p_society and user_id = auth.uid();
end;
$$;

-- Society admins can make a member an admin (to share event organising).
create or replace function public.set_society_admin(p_society uuid, p_user uuid, p_admin boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_society_admin(p_society) then
    raise exception 'Only society admins can do that' using errcode = '42501';
  end if;
  if not p_admin and p_user = auth.uid() and (
    select count(*) from public.society_members where society_id = p_society and role = 'admin'
  ) = 1 then
    raise exception 'A society needs at least one admin' using errcode = '22023';
  end if;
  update public.society_members set role = case when p_admin then 'admin' else 'member' end
  where society_id = p_society and user_id = p_user;
  if not found then
    raise exception 'They need to join first' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.societies_list()
returns table (id uuid, name text, slug text, description text, emoji text, verified boolean,
               member_count int, my_role text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.slug, s.description, s.emoji, s.verified,
    (select count(*)::int from public.society_members m where m.society_id = s.id),
    (select m.role from public.society_members m where m.society_id = s.id and m.user_id = auth.uid())
  from public.societies s
  where public.is_verified() and s.university_id = public.my_university_id()
    and (s.verified or s.created_by = auth.uid() or public.is_admin())
  order by s.verified desc, s.name;
$$;

create or replace function public.society_people(p_society uuid)
returns table (user_id uuid, role text, handle text, full_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, m.role, p.handle::text, p.full_name, public.shown_avatar(p.id)
  from public.society_members m
  join public.profiles p on p.id = m.user_id
  join public.societies s on s.id = m.society_id
  where m.society_id = p_society and public.is_verified()
    and s.university_id = public.my_university_id()
    and (s.verified or s.created_by = auth.uid() or public.is_admin())
    and not public.blocked_with(p.id)
  order by m.role, p.full_name
  limit 200;
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  society_id uuid references public.societies on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null check (char_length(venue) between 2 and 100),
  capacity int check (capacity between 1 and 5000),
  created_by uuid references public.profiles on delete set null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  reminded_at timestamptz,
  check (ends_at > starts_at)
);
create index events_board_idx on public.events (university_id, starts_at);
alter table public.events enable row level security;
create policy events_read on public.events for select to authenticated
  using ((select public.is_verified()) and university_id = (select public.my_university_id()));
revoke all on public.events from anon, authenticated;
grant select on public.events to authenticated;
grant all on public.events to service_role;

create table public.event_rsvps (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_idx on public.event_rsvps (user_id);
alter table public.event_rsvps enable row level security;
create policy event_rsvps_own on public.event_rsvps for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.event_rsvps from anon, authenticated;
grant select on public.event_rsvps to authenticated;
grant all on public.event_rsvps to service_role;

-- Society admins post events for verified societies; app admins can post campus-wide ones.
create or replace function public.create_event(
  p_society uuid, p_title text, p_description text, p_starts timestamptz, p_ends timestamptz,
  p_venue text, p_capacity int default null
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_society is null then
    if not public.is_admin() then
      raise exception 'Events are posted by societies' using errcode = '42501';
    end if;
  elsif not public.is_society_admin(p_society)
        or not exists (select 1 from public.societies where id = p_society and verified) then
    raise exception 'Only admins of a verified society can post its events' using errcode = '42501';
  end if;
  if p_starts < now() or p_starts > now() + interval '1 year' then
    raise exception 'Pick a start time in the next year' using errcode = '22023';
  end if;
  if (select count(*) from public.events
      where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 events today.' using errcode = '54000';
  end if;
  insert into public.events (university_id, society_id, title, description, starts_at, ends_at,
                             venue, capacity, created_by)
  values (public.my_university_id(), p_society, trim(p_title), trim(coalesce(p_description, '')),
          p_starts, p_ends, trim(p_venue), p_capacity, auth.uid())
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.cancel_event(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_event public.events;
  v_user uuid;
begin
  select * into v_event from public.events where id = p_event and status = 'active' for update;
  if not found or not (v_event.created_by = auth.uid() or public.is_admin()
                       or (v_event.society_id is not null and public.is_society_admin(v_event.society_id))) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  update public.events set status = 'cancelled' where id = p_event;
  for v_user in select user_id from public.event_rsvps where event_id = p_event loop
    perform public.notify(v_user, 'event.cancelled', null, 'event', p_event,
                          jsonb_build_object('title', v_event.title));
  end loop;
end;
$fn$;

-- Going / interested / (null) no longer. "Going" respects capacity.
create or replace function public.rsvp_event(p_event uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_event public.events;
begin
  select * into v_event from public.events
  where id = p_event and university_id = public.my_university_id() for update;
  if not found or not public.is_verified() then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if p_status is null then
    delete from public.event_rsvps where event_id = p_event and user_id = auth.uid();
    return;
  end if;
  if v_event.status <> 'active' or v_event.ends_at < now() then
    raise exception 'This event is over or cancelled' using errcode = '22023';
  end if;
  if p_status = 'going' and v_event.capacity is not null and (
    select count(*) from public.event_rsvps
    where event_id = p_event and status = 'going' and user_id <> auth.uid()
  ) >= v_event.capacity then
    raise exception 'This event is full. Mark yourself interested instead.' using errcode = '22023';
  end if;
  insert into public.event_rsvps (event_id, user_id, status) values (p_event, auth.uid(), p_status)
  on conflict (event_id, user_id) do update set status = excluded.status;
end;
$fn$;

create or replace function public.events_board(p_society uuid default null, p_mine boolean default false)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz,
               venue text, capacity int, status text, society_id uuid, society_name text,
               society_slug text, society_emoji text, going int, interested int, my_rsvp text,
               can_manage boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.description, e.starts_at, e.ends_at, e.venue, e.capacity, e.status,
    s.id, s.name, s.slug, s.emoji,
    (select count(*)::int from public.event_rsvps r where r.event_id = e.id and r.status = 'going'),
    (select count(*)::int from public.event_rsvps r where r.event_id = e.id and r.status = 'interested'),
    (select r.status from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()),
    e.created_by = auth.uid() or public.is_admin()
      or (e.society_id is not null and public.is_society_admin(e.society_id))
  from public.events e
  left join public.societies s on s.id = e.society_id
  where public.is_verified() and e.university_id = public.my_university_id()
    and e.ends_at > now()
    and (p_society is null or e.society_id = p_society)
    and (not p_mine or exists (select 1 from public.event_rsvps r
                               where r.event_id = e.id and r.user_id = auth.uid()))
  order by e.starts_at
  limit 100;
$$;

-- Every 5 minutes: remind going/interested students about events starting within the hour.
create or replace function public.event_reminders() returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_event public.events;
  v_user uuid;
begin
  for v_event in
    update public.events set reminded_at = now()
    where status = 'active' and reminded_at is null
      and starts_at > now() and starts_at <= now() + interval '65 minutes'
    returning *
  loop
    for v_user in select user_id from public.event_rsvps where event_id = v_event.id loop
      perform public.notify(v_user, 'event.reminder', null, 'event', v_event.id,
        jsonb_build_object('title', v_event.title, 'venue', v_event.venue, 'starts_at', v_event.starts_at));
    end loop;
  end loop;
end;
$fn$;
select cron.schedule('event-reminders', '*/5 * * * *', 'select public.event_reminders()');

-- ===========================================================================
-- Permissions.
-- ===========================================================================
revoke execute on function public.shown_avatar(uuid), public.women_eligible(),
  public.request_women_only(text), public.decide_women_only(uuid, boolean), public.women_only_queue(),
  public.can_see_ride(public.rides),
  public.create_ride(text, text, text, timestamptz, int, smallint[], boolean, text),
  public.request_seat(uuid, text), public.respond_seat(uuid, boolean), public.cancel_seat(uuid),
  public.cancel_ride(uuid), public.rides_board(text, boolean), public.ride_requests_for(uuid),
  public.create_listing(text, text, text, int, text[], text, text, text),
  public.mark_listing_done(uuid), public.delete_listing(uuid),
  public.market_listings(text, text, timestamptz, boolean),
  public.is_society_admin(uuid), public.create_society(text, text, text, text),
  public.verify_society(uuid, boolean), public.join_society(uuid), public.leave_society(uuid),
  public.set_society_admin(uuid, uuid, boolean), public.societies_list(), public.society_people(uuid),
  public.create_event(uuid, text, text, timestamptz, timestamptz, text, int),
  public.cancel_event(uuid), public.rsvp_event(uuid, text), public.events_board(uuid, boolean)
  from public, anon;
grant execute on function public.shown_avatar(uuid), public.women_eligible(),
  public.request_women_only(text), public.decide_women_only(uuid, boolean), public.women_only_queue(),
  public.can_see_ride(public.rides),
  public.create_ride(text, text, text, timestamptz, int, smallint[], boolean, text),
  public.request_seat(uuid, text), public.respond_seat(uuid, boolean), public.cancel_seat(uuid),
  public.cancel_ride(uuid), public.rides_board(text, boolean), public.ride_requests_for(uuid),
  public.create_listing(text, text, text, int, text[], text, text, text),
  public.mark_listing_done(uuid), public.delete_listing(uuid),
  public.market_listings(text, text, timestamptz, boolean),
  public.is_society_admin(uuid), public.create_society(text, text, text, text),
  public.verify_society(uuid, boolean), public.join_society(uuid), public.leave_society(uuid),
  public.set_society_admin(uuid, uuid, boolean), public.societies_list(), public.society_people(uuid),
  public.create_event(uuid, text, text, timestamptz, timestamptz, text, int),
  public.cancel_event(uuid), public.rsvp_event(uuid, text), public.events_board(uuid, boolean)
  to authenticated;
revoke execute on function public.event_reminders() from public, anon, authenticated;
