-- C2, C5, C6, C7, C8 from the engineering review.
--   C2: Backup points can't be farmed by two friends, and stepping back from a request can't
--       be repeated to spam its asker.
--   C5: leaving a course also leaves its chat and study groups; a new term offers last term's
--       courses instead of an empty list.
--   C6: Restore only brings back what staff removed (never what its author deleted), and
--       moderating a comment keeps the post's comment count right.
--   C7: either person can end a mentorship.
--   C8: importing the same timetable twice doesn't duplicate classes.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connect.request', 'connect.accepted',
  'backup.nearby', 'backup.claimed', 'backup.unclaimed', 'backup.resolved', 'backup.cancelled',
  'backup.expired',
  'post.comment', 'comment.reply',
  'ping', 'mentor.request', 'mentor.accepted', 'mentor.ended',
  'ride.request', 'ride.accepted', 'ride.declined', 'ride.cancelled', 'ride.left',
  'event.reminder', 'event.cancelled', 'society.verified', 'access.women_only',
  'account.warning', 'content.removed', 'badge.awarded',
  'feature.live', 'system.test',
  'studies.approved', 'studies.rejected'
));

-- ===========================================================================
-- C2: Backup points.
-- ===========================================================================
-- Points earned by the helper for this request (0 when the same pair already earned points in
-- the last 7 days), and who stepped back from it.
alter table public.backup_requests
  add column points_awarded smallint not null default 0,
  add column unclaimed_by uuid[] not null default '{}';
update public.backup_requests set points_awarded = 10 where status = 'resolved';

-- Offer to help. Someone who stepped back from a request can't take it again: claiming and
-- un-claiming would otherwise notify the asker over and over.
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
  if auth.uid() = any(v_req.unclaimed_by) then
    raise exception 'You stepped back from this one, so someone else can help' using errcode = '22023';
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
     set status = 'open', claimed_by = null, claimed_at = null, conversation_id = null,
         unclaimed_by = array_append(unclaimed_by, auth.uid())
   where id = p_request;
  delete from public.conversations where id = v_req.conversation_id and kind = 'backup_temp';
  perform public.notify(v_req.requester_id, 'backup.unclaimed', auth.uid(), 'backup', p_request,
                        jsonb_build_object('title', v_req.title));
end;
$$;

-- The requester marks it done. The helper earns 10 points, once a week per pair: two friends
-- trading requests can't climb the Backup Hero board.
create or replace function public.resolve_backup(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.backup_requests;
  v_points smallint := 10;
begin
  select * into v_req from public.backup_requests
  where id = p_request and requester_id = auth.uid() and status = 'claimed' for update;
  if not found then
    raise exception 'Only a claimed request can be marked done' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.backup_requests b
             where b.requester_id = v_req.requester_id and b.claimed_by = v_req.claimed_by
               and b.points_awarded > 0 and b.resolved_at > now() - interval '7 days') then
    v_points := 0;
  end if;
  update public.backup_requests
     set status = 'resolved', resolved_at = now(), closed_at = now(), points_awarded = v_points
   where id = p_request;
  update public.conversations set expires_at = now() + interval '72 hours'
   where id = v_req.conversation_id;
  if v_points > 0 then
    insert into public.backup_points (user_id, points, helped_count)
    values (v_req.claimed_by, v_points, 1)
    on conflict (user_id) do update
      set points = public.backup_points.points + v_points,
          helped_count = public.backup_points.helped_count + 1;
  end if;
  perform public.notify(v_req.claimed_by, 'backup.resolved', auth.uid(), 'backup', p_request,
    jsonb_build_object('title', v_req.title)
      || case when v_points > 0 then jsonb_build_object('points', v_points) else '{}' end);
end;
$$;

-- The board counts requests that earned points, so repeats between a pair count once a week.
create or replace function public.backup_leaderboard(p_department_only boolean default false)
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
      and b.claimed_by is not null and b.points_awarded > 0
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

-- ===========================================================================
-- C5: courses.
-- ===========================================================================
-- Leaving a course takes you off its class list, out of its chat and out of its study groups
-- (a group you started passes to someone else, as leaving any group does).
drop function if exists public.leave_course(uuid);
create function public.leave_course(p_course uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_conv uuid;
begin
  delete from public.enrollments
  where user_id = auth.uid() and course_id = p_course and term = public.current_term();
  for v_conv in
    select c.id from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id and m.user_id = auth.uid()
    where c.course_id = p_course
      and (c.kind = 'course'
           or exists (select 1 from public.study_groups g where g.conversation_id = c.id))
  loop
    perform public.leave_conversation(v_conv);
  end loop;
end;
$$;

-- Terms in order: spring, summer, fall within a year.
create or replace function public.term_rank(p_term text) returns int
language sql immutable set search_path = '' as $$
  select split_part(p_term, '-', 1)::int * 10
       + case split_part(p_term, '-', 2) when 'spring' then 1 when 'summer' then 2 else 3 end;
$$;

-- Courses from the caller's most recent earlier term, offered when this term's list is empty.
create or replace function public.last_term_courses()
returns table (id uuid, code text, title text, term text)
language sql stable security definer set search_path = '' as $$
  with prev as (
    select e.term from public.enrollments e
    where e.user_id = auth.uid() and public.term_rank(e.term) < public.term_rank(public.current_term())
    order by public.term_rank(e.term) desc
    limit 1
  )
  select c.id, c.code, c.title, e.term
  from public.enrollments e
  join prev on prev.term = e.term
  join public.courses c on c.id = e.course_id
  where e.user_id = auth.uid()
  order by c.code;
$$;

-- ===========================================================================
-- C6: moderation.
-- ===========================================================================
-- Restore brings back only what staff removed: an author who deleted their own post (also
-- "removed") stays deleted. Posts held for review can still be published. Comment changes
-- keep the post's comment count, which counts published comments, in step.
create or replace function public.moderate_content(
  p_type text, p_id uuid, p_action text, p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare
  v_university uuid;
  v_space text;
  v_author uuid;
  v_before text;
  v_after text;
  v_copy jsonb := '{}';
  v_post uuid;
begin
  if p_action not in ('hide', 'restore') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if p_type = 'post' then
    select university_id, space, author_id, status::text into v_university, v_space, v_author, v_before
    from public.posts where id = p_id;
  elsif p_type = 'comment' then
    select p.university_id, p.space, c.author_id, c.status::text, c.post_id
      into v_university, v_space, v_author, v_before, v_post
    from public.comments c join public.posts p on p.id = c.post_id where c.id = p_id;
  elsif p_type = 'listing' then
    select university_id, null, user_id, status into v_university, v_space, v_author, v_before
    from public.listings where id = p_id;
  elsif p_type = 'resource' then
    select d.university_id, null, r.uploader_id, r.status::text into v_university, v_space, v_author, v_before
    from public.resources r join public.courses c on c.id = r.course_id
    join public.departments d on d.id = c.department_id where r.id = p_id;
  elsif p_type = 'ride' then
    select university_id, null, user_id, status into v_university, v_space, v_author, v_before
    from public.rides where id = p_id;
  elsif p_type = 'event' then
    select university_id, null, created_by, status into v_university, v_space, v_author, v_before
    from public.events where id = p_id;
  elsif p_type = 'message' then
    -- Some chats have no university of their own; the sender's works for finding the row.
    select coalesce(c.university_id, s.university_id), null, m.sender_id,
           case when m.deleted_at is null then 'published' else 'removed' end,
           jsonb_build_object('body', m.body, 'attachment_path', m.attachment_path)
      into v_university, v_space, v_author, v_before, v_copy
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    left join public.profiles s on s.id = m.sender_id
    where m.id = p_id;
  else
    raise exception 'That can''t be moderated here' using errcode = '22023';
  end if;
  if v_university is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or (p_type in ('post', 'comment') and public.can_moderate(v_university, v_space))) then
    raise exception 'You can''t moderate this' using errcode = '42501';
  end if;

  if p_action = 'restore' then
    if p_type = 'message' then
      raise exception 'A removed message can''t be restored' using errcode = '22023';
    end if;
    -- Held for review: publishing it is what restore is for. Otherwise the last staff action
    -- on it must be a removal; anything else was the author's own doing.
    if v_before <> 'held' and coalesce((
         select a.action from public.audit_log a
         where a.target_type = p_type and a.target_id = p_id
           and a.action in ('content.hide', 'content.restore')
         order by a.created_at desc limit 1), '') <> 'content.hide' then
      raise exception 'Only something staff removed can be restored' using errcode = '22023';
    end if;
  end if;

  if p_type = 'post' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.posts set status = v_after where id = p_id;
  elsif p_type = 'comment' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.comments set status = v_after where id = p_id;
    if v_before = 'published' and v_after <> 'published' then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = v_post;
    elsif v_before <> 'published' and v_after = 'published' then
      update public.posts set comment_count = comment_count + 1 where id = v_post;
    end if;
  elsif p_type = 'listing' then
    v_after := case when p_action = 'hide' then 'removed' else 'active' end;
    update public.listings set status = v_after where id = p_id;
  elsif p_type = 'resource' then
    v_after := case when p_action = 'hide' then 'removed' else 'published' end;
    update public.resources set status = v_after where id = p_id;
  elsif p_type = 'ride' then
    v_after := case when p_action = 'hide' then 'cancelled' else 'open' end;
    update public.rides set status = v_after where id = p_id;
  elsif p_type = 'message' then
    v_after := 'removed';
    update public.messages set body = null, attachment_path = null, deleted_at = coalesce(deleted_at, now())
    where id = p_id;
  else
    v_after := case when p_action = 'hide' then 'cancelled' else 'active' end;
    update public.events set status = v_after where id = p_id;
  end if;

  update public.reports
     set status = case when p_action = 'hide' then 'actioned' else 'dismissed' end::public.report_status,
         handled_by = auth.uid(), handled_at = now()
   where target_type = p_type and target_id = p_id and status = 'open';
  if p_action = 'hide' then
    perform public.notify(v_author, 'content.removed', null, p_type, p_id,
                          jsonb_build_object('kind', p_type, 'reason', p_reason));
  end if;
  perform public.audit('content.' || p_action, p_type, p_id,
    jsonb_build_object('status', v_before) || v_copy,
    jsonb_build_object('status', v_after, 'reason', p_reason));
end;
$fn$;

-- Counts drifted while moderator removals didn't touch them: set them from the comments.
update public.posts p set comment_count = coalesce((
  select count(*) from public.comments c where c.post_id = p.id and c.status = 'published'), 0)
where p.comment_count is distinct from coalesce((
  select count(*) from public.comments c where c.post_id = p.id and c.status = 'published'), 0);

-- ===========================================================================
-- C7: mentorships.
-- ===========================================================================
-- The caller's mentors and mentees (accepted).
create or replace function public.my_mentorships()
returns table (other_id uuid, handle text, full_name text, avatar_url text, i_am text,
               since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle::text, p.full_name, public.shown_avatar(p.id),
    case when m.mentor_id = auth.uid() then 'mentor' else 'mentee' end,
    coalesce(m.responded_at, m.created_at)
  from public.mentorships m
  join public.profiles p
    on p.id = case when m.mentor_id = auth.uid() then m.mentee_id else m.mentor_id end
  where m.status = 'accepted' and (m.mentor_id = auth.uid() or m.mentee_id = auth.uid())
    and p.deleted_at is null
  order by coalesce(m.responded_at, m.created_at) desc;
$$;

-- Either person ends it. You stay connected, so you can still message each other.
create or replace function public.end_mentorship(p_other uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mentorships set status = 'ended', responded_at = now()
  where status = 'accepted'
    and ((mentor_id = auth.uid() and mentee_id = p_other)
         or (mentee_id = auth.uid() and mentor_id = p_other));
  if not found then
    raise exception 'No mentorship to end' using errcode = 'P0002';
  end if;
  perform public.notify(p_other, 'mentor.ended', auth.uid(), 'profile', auth.uid());
end;
$$;

-- ===========================================================================
-- C8: timetable.
-- ===========================================================================
-- One class per day and time per term: clear existing repeats, then hold the line.
delete from public.timetable_slots s
using public.timetable_slots t
where s.user_id = t.user_id and s.term = t.term and s.day = t.day
  and s.start_min = t.start_min and s.end_min = t.end_min and s.id > t.id;
create unique index timetable_slots_once_uq
  on public.timetable_slots (user_id, term, day, start_min, end_min);

-- ===========================================================================
-- Grants.
-- ===========================================================================
revoke execute on function public.term_rank(text) from public, anon, authenticated;
revoke execute on function public.leave_course(uuid), public.last_term_courses(),
  public.my_mentorships(), public.end_mentorship(uuid) from public, anon;
grant execute on function public.leave_course(uuid), public.last_term_courses(),
  public.my_mentorships(), public.end_mentorship(uuid) to authenticated;
