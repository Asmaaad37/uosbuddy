-- Phase 4 (part 3). Rate limits move into the database: send_message and
-- request_connection are callable straight from the browser with a student's own token,
-- so limits checked only in our server actions could be skipped. Also: the blocked list.

create index if not exists messages_sender_recent_idx on public.messages (sender_id, created_at desc);
create index if not exists connections_requester_recent_idx on public.connections (requester_id, created_at desc);

-- Messages: 60 a minute per student (real chats never get close).
create or replace function public.check_message_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'You''re sending messages very fast. Wait a moment.' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.check_message_rate();

-- Connection requests: 30 a day per student (Phase 4 task 7).
create or replace function public.check_connection_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.connections
      where requester_id = new.requester_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of requests for one day. Try again tomorrow.' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger connections_rate_limit
  before insert or update of requester_id, created_at on public.connections
  for each row execute function public.check_connection_rate();

-- The students you've blocked, for Settings → Blocked (names only; no profile access).
create or replace function public.my_blocked()
returns table (id uuid, handle text, full_name text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke execute on function public.check_message_rate(), public.check_connection_rate()
  from public, anon, authenticated;
revoke execute on function public.my_blocked() from public, anon;
grant execute on function public.my_blocked() to authenticated;
