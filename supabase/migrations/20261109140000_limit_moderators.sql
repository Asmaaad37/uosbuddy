-- Moderators could read every report, including who sent it, and warn any student. Their
-- queue (moderation_queue) already shows only their feeds, without the reporter, so the raw
-- table is now admin-only, and they can warn only people who wrote something in their feeds.
drop policy reports_staff on public.reports;
create policy reports_admin on public.reports for select to authenticated
  using ((select public.is_admin()));

create or replace function public.warn_user(p_user uuid, p_message text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_message, ''))) < 5 then
    raise exception 'Say what the warning is about' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;
  if not public.is_admin()
     and not exists (select 1 from public.posts p
                     where p.author_id = p_user and public.can_moderate(p.university_id, p.space))
     and not exists (select 1 from public.comments c join public.posts p on p.id = c.post_id
                     where c.author_id = p_user and public.can_moderate(p.university_id, p.space)) then
    raise exception 'You can only warn students who posted in your feeds' using errcode = '42501';
  end if;
  perform public.notify(p_user, 'account.warning', null, null, null,
                        jsonb_build_object('message', left(trim(p_message), 500)));
  perform public.audit('user.warn', 'profile', p_user, null, jsonb_build_object('message', trim(p_message)));
end;
$$;
