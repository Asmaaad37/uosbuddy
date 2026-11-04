-- Phase 10, second pass at feed_page (k6: the lateral lookup into the barrier view didn't
-- reach the index under load). Pick the page's ids from posts with the visibility rules
-- written inline, so the (university, space, score/time, id) index orders and stops at
-- the limit; then read exactly those rows from posts_public, which stays the final check.
create or replace function public.feed_page(
  p_space text,
  p_sort text default 'hot',
  p_after_score double precision default null,
  p_after_created timestamptz default null,
  p_after_id uuid default null,
  p_limit int default 20
) returns setof public.posts_public
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_me uuid := auth.uid();
  v_uni uuid;
  v_dept uuid;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_ids uuid[];
begin
  select university_id, department_id into v_uni, v_dept from public.profiles
  where id = v_me and verification_status = 'verified' and banned_at is null and deleted_at is null;
  if v_uni is null or not (p_space = 'campus' or p_space = 'department:' || v_dept::text) then
    return;
  end if;

  if p_sort = 'new' then
    select array_agg(id order by created_at desc, id desc) into v_ids from (
      select p.id, p.created_at from public.posts p
      where p.university_id = v_uni and p.space = p_space
        and (p.status = 'published' or (p.status = 'held' and p.author_id = v_me))
        and (p_after_id is null or (p.created_at, p.id) < (p_after_created, p_after_id))
        and not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me))
      order by p.created_at desc, p.id desc
      limit v_limit) page;
    return query select v.* from public.posts_public v where v.id = any (v_ids)
      order by v.created_at desc, v.id desc;
  else
    select array_agg(id order by hot_score desc, id desc) into v_ids from (
      select p.id, p.hot_score from public.posts p
      where p.university_id = v_uni and p.space = p_space
        and (p.status = 'published' or (p.status = 'held' and p.author_id = v_me))
        and (p_after_id is null or (p.hot_score, p.id) < (p_after_score, p_after_id))
        and not exists (select 1 from public.blocks b
                        where (b.blocker_id = v_me and b.blocked_id = p.author_id)
                           or (b.blocker_id = p.author_id and b.blocked_id = v_me))
      order by p.hot_score desc, p.id desc
      limit v_limit) page;
    return query select v.* from public.posts_public v where v.id = any (v_ids)
      order by v.hot_score desc, v.id desc;
  end if;
end;
$fn$;
