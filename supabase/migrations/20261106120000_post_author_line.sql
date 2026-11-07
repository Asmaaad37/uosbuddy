-- Redesign §5.2: a post's header reads "CS · 2022 · Wed", so posts_public also returns the
-- author's department code and batch year (null on anonymous posts, like the rest of the
-- author columns). New columns go at the end so the view can be replaced in place.

create or replace view public.posts_public with (security_barrier = true) as
select
  p.id, p.created_at, p.space, p.body, p.media_paths, p.poll, p.is_anonymous,
  p.upvotes, p.downvotes, p.comment_count, p.hot_score, p.status,
  case when p.is_anonymous then null else p.author_id end as author_id,
  case when p.is_anonymous then null else a.handle::text end as author_handle,
  case when p.is_anonymous then al.alias else a.full_name end as author_name,
  case when not p.is_anonymous and public.visible_at(a.id, s.photo_visibility)
       then a.avatar_url end as author_avatar,
  p.author_id = auth.uid() as is_mine,
  (select value from public.post_votes v where v.post_id = p.id and v.user_id = auth.uid()) as my_vote,
  (select option from public.poll_votes v where v.post_id = p.id and v.user_id = auth.uid()) as my_poll_option,
  case when p.poll is not null then array(
    select count(pv.*)::int
    from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o
    left join public.poll_votes pv on pv.post_id = p.id and pv.option = o
    group by o order by o
  ) end as poll_counts,
  case when p.is_anonymous then null else d.short_code end as author_department_code,
  case when p.is_anonymous then null else a.batch_year end as author_batch_year
from public.posts p
join public.profiles a on a.id = p.author_id
join public.privacy_settings s on s.user_id = a.id
left join public.departments d on d.id = a.department_id
left join public.anon_aliases al on al.post_id = p.id and al.user_id = p.author_id
where public.can_see_space(p.university_id, p.space)
  and (p.status = 'published' or (p.status = 'held' and p.author_id = auth.uid()))
  -- Blocks hide named posts both ways; anonymous ones too (without saying why).
  and not public.blocked_with(p.author_id);
