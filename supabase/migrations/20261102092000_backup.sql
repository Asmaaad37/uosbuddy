-- Phase 5 (part 1c): Backup Requests, the signature feature (§4.3, §4.5, §4.7).
-- open → claimed → resolved; open → expired (cron); open|claimed → cancelled by the
-- requester; claimed → open when the helper un-claims. Claiming opens a temporary chat
-- that ends 72 hours after the request closes. Fan-out notifies up to 50 classmates.

create table public.backup_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  requester_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  details text check (char_length(details) <= 1000),
  category text not null check (category in ('notes', 'help', 'ride', 'company', 'item', 'other')),
  course_id uuid references public.courses on delete set null,
  department_id uuid references public.departments on delete set null,
  urgency smallint not null default 2 check (urgency between 1 and 3),
  status public.backup_status not null default 'open',
  claimed_by uuid references public.profiles on delete set null,
  claimed_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  expires_at timestamptz not null default now() + interval '48 hours',
  conversation_id uuid references public.conversations on delete set null,
  notified_count int not null default 0
);
create index backup_open_idx on public.backup_requests (university_id, status, created_at desc);
create index backup_requester_idx on public.backup_requests (requester_id, created_at desc);
create index backup_claimer_idx on public.backup_requests (claimed_by, created_at desc);

create table public.backup_points (
  user_id uuid primary key references public.profiles on delete cascade,
  points int not null default 0,
  helped_count int not null default 0
);

alter table public.backup_requests enable row level security;
alter table public.backup_points enable row level security;
-- Verified students at the same university see requests (not across a block); the people
-- involved always see their own.
create policy backup_read on public.backup_requests for select to authenticated
  using (requester_id = (select auth.uid()) or claimed_by = (select auth.uid())
         or ((select public.is_verified()) and university_id = (select public.my_university_id())
             and not public.blocked_with(requester_id)));
create policy backup_points_read on public.backup_points for select to authenticated
  using ((select public.is_verified()));
revoke all on public.backup_requests, public.backup_points from anon, authenticated;
grant select on public.backup_requests, public.backup_points to authenticated;
grant all on public.backup_requests, public.backup_points to service_role;
alter publication supabase_realtime add table public.backup_requests;

-- Fan-out (§4.7): same section, then department batch, then the department's mentors;
-- 50 at most; skips anyone who muted Backup pings, got 5 today, or is blocked.
create or replace function public.backup_fanout(p_request uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
  v_me public.profiles;
  v_sent int := 0;
begin
  select * into v_req from public.backup_requests where id = p_request;
  select * into v_me from public.profiles where id = v_req.requester_id;

  with candidates as (
    select t.id,
      case
        when v_me.section is not null and t.department_id = v_me.department_id
             and t.batch_year = v_me.batch_year and t.section = v_me.section then 1
        when t.department_id = v_me.department_id and t.batch_year = v_me.batch_year then 2
        when t.department_id = v_me.department_id and t.is_mentor then 3
      end as tier
    from public.profiles t
    where t.university_id = v_req.university_id and t.id <> v_req.requester_id
      and t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
      and t.onboarding_step >= 4
  ),
  picked as (
    select c.id from candidates c
    where c.tier is not null
      and public.wants(c.id, 'backup.nearby')
      and not public.blocked_between(c.id, v_req.requester_id)
      and (select count(*) from public.notifications n
           where n.user_id = c.id and n.type = 'backup.nearby'
             and n.created_at > now() - interval '1 day') < 5
    order by c.tier, random()
    limit 50
  ),
  sent as (
    insert into public.notifications (user_id, type, actor_id, entity_type, entity_id, payload)
    select p.id, 'backup.nearby', v_req.requester_id, 'backup', v_req.id,
      jsonb_build_object('title', v_req.title, 'category', v_req.category, 'urgency', v_req.urgency)
    from picked p
    returning 1
  )
  select count(*) into v_sent from sent;

  update public.backup_requests set notified_count = v_sent where id = p_request;
  return v_sent;
end;
$$;

-- Ask for backup. Returns the request id; classmates are notified straight away.
create or replace function public.create_backup(
  p_title text, p_details text, p_category text, p_course uuid default null,
  p_urgency int default 2, p_hours int default 48
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.profiles;
  v_id uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  if (select count(*) from public.backup_requests
      where requester_id = v_me.id and status in ('open', 'claimed')) >= 3 then
    raise exception 'You have 3 open requests. Close one first.' using errcode = '54000';
  end if;
  if (select count(*) from public.backup_requests
      where requester_id = v_me.id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s 5 requests today. Try again tomorrow.' using errcode = '54000';
  end if;
  if p_hours not between 1 and 72 then
    raise exception 'Pick how long it stays open (1–72 hours)' using errcode = '22023';
  end if;

  insert into public.backup_requests
    (university_id, requester_id, title, details, category, course_id, department_id,
     urgency, expires_at)
  values (v_me.university_id, v_me.id, trim(p_title), nullif(trim(p_details), ''), p_category,
          p_course, v_me.department_id, p_urgency, now() + make_interval(hours => p_hours))
  returning id into v_id;
  perform public.backup_fanout(v_id);
  return v_id;
end;
$$;

-- Offer to help: opens a temporary chat with the requester.
create or replace function public.claim_backup(p_request uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
  v_conv uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  select * into v_req from public.backup_requests where id = p_request for update;
  if not found or v_req.university_id <> public.my_university_id()
     or public.blocked_with(v_req.requester_id) then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if v_req.requester_id = auth.uid() then
    raise exception 'You can''t claim your own request' using errcode = '22023';
  end if;
  if v_req.status <> 'open' or v_req.expires_at < now() then
    raise exception 'Someone already picked this up' using errcode = '22023';
  end if;

  insert into public.conversations (kind, university_id, title, created_by)
  values ('backup_temp', v_req.university_id, left('Backup: ' || v_req.title, 60), auth.uid())
  returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id, accepted_at)
  values (v_conv, v_req.requester_id, now()), (v_conv, auth.uid(), now());

  update public.backup_requests
     set status = 'claimed', claimed_by = auth.uid(), claimed_at = now(), conversation_id = v_conv
   where id = p_request;
  perform public.notify(v_req.requester_id, 'backup.claimed', auth.uid(), 'backup', p_request,
                        jsonb_build_object('title', v_req.title));
  return v_conv;
end;
$$;

-- The helper steps back: the request reopens and their chat closes.
create or replace function public.unclaim_backup(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
begin
  select * into v_req from public.backup_requests
  where id = p_request and claimed_by = auth.uid() and status = 'claimed' for update;
  if not found then
    raise exception 'Nothing to un-claim' using errcode = 'P0002';
  end if;
  update public.backup_requests
     set status = 'open', claimed_by = null, claimed_at = null, conversation_id = null
   where id = p_request;
  delete from public.conversations where id = v_req.conversation_id and kind = 'backup_temp';
  perform public.notify(v_req.requester_id, 'backup.unclaimed', auth.uid(), 'backup', p_request,
                        jsonb_build_object('title', v_req.title));
end;
$$;

-- The requester marks it done: the helper earns 10 points; the chat ends in 72 hours.
create or replace function public.resolve_backup(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
begin
  select * into v_req from public.backup_requests
  where id = p_request and requester_id = auth.uid() and status = 'claimed' for update;
  if not found then
    raise exception 'Only a claimed request can be marked done' using errcode = 'P0002';
  end if;
  update public.backup_requests
     set status = 'resolved', resolved_at = now(), closed_at = now()
   where id = p_request;
  update public.conversations set expires_at = now() + interval '72 hours'
   where id = v_req.conversation_id;
  insert into public.backup_points (user_id, points, helped_count)
  values (v_req.claimed_by, 10, 1)
  on conflict (user_id) do update
    set points = public.backup_points.points + 10,
        helped_count = public.backup_points.helped_count + 1;
  perform public.notify(v_req.claimed_by, 'backup.resolved', auth.uid(), 'backup', p_request,
                        jsonb_build_object('title', v_req.title, 'points', 10));
end;
$$;

-- The requester calls it off (open or claimed).
create or replace function public.cancel_backup(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
begin
  select * into v_req from public.backup_requests
  where id = p_request and requester_id = auth.uid() and status in ('open', 'claimed') for update;
  if not found then
    raise exception 'Nothing to cancel' using errcode = 'P0002';
  end if;
  update public.backup_requests set status = 'cancelled', closed_at = now() where id = p_request;
  update public.conversations set expires_at = now() + interval '72 hours'
   where id = v_req.conversation_id;
  if v_req.claimed_by is not null then
    perform public.notify(v_req.claimed_by, 'backup.cancelled', auth.uid(), 'backup', p_request,
                          jsonb_build_object('title', v_req.title));
  end if;
end;
$$;

-- "Open near you": open requests at your university, nearest first (section, batch,
-- department, everyone), then most urgent, then newest.
create or replace function public.backup_feed(p_limit int default 30)
returns table (id uuid, created_at timestamptz, title text, details text, category text,
               urgency smallint, expires_at timestamptz, course_code text,
               requester_id uuid, requester_handle text, requester_name text,
               requester_avatar text, nearness int)
language sql stable security definer set search_path = '' as $$
  with v as (select * from public.profiles where id = auth.uid())
  select r.id, r.created_at, r.title, r.details, r.category, r.urgency, r.expires_at,
    c.code, p.id, p.handle::text, p.full_name,
    case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end,
    case
      when v.section is not null and p.department_id = v.department_id
           and p.batch_year = v.batch_year and p.section = v.section then 1
      when p.department_id = v.department_id and p.batch_year = v.batch_year then 2
      when p.department_id = v.department_id then 3
      else 4
    end
  from v
  join public.backup_requests r on r.university_id = v.university_id
  join public.profiles p on p.id = r.requester_id
  join public.privacy_settings s on s.user_id = p.id
  left join public.courses c on c.id = r.course_id
  where public.is_verified() and r.status = 'open' and r.expires_at > now()
    and r.requester_id <> v.id and not public.blocked_with(r.requester_id)
  order by 13, r.urgency desc, r.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Expiry: open requests past their time; temporary chats past theirs.
create or replace function public.backup_housekeeping() returns void
language sql security definer set search_path = '' as $$
  update public.backup_requests set status = 'expired', closed_at = now()
  where status = 'open' and expires_at < now();
  delete from public.conversations where kind = 'backup_temp' and expires_at < now();
$$;

create extension if not exists pg_cron;
select cron.schedule('backup-housekeeping', '*/10 * * * *', 'select public.backup_housekeeping()');

revoke execute on function public.backup_fanout(uuid), public.backup_housekeeping()
  from public, anon, authenticated;
revoke execute on function public.create_backup(text, text, text, uuid, int, int),
  public.claim_backup(uuid), public.unclaim_backup(uuid), public.resolve_backup(uuid),
  public.cancel_backup(uuid), public.backup_feed(int) from public, anon;
grant execute on function public.create_backup(text, text, text, uuid, int, int),
  public.claim_backup(uuid), public.unclaim_backup(uuid), public.resolve_backup(uuid),
  public.cancel_backup(uuid), public.backup_feed(int) to authenticated;
