-- Phase 5 (part 1b): the feed. Students never read the base tables: posts_public and
-- comments_public return author_id = null and a per-thread alias for anonymous posts
-- (§4.4), and every write goes through a function. Hot score per §4.7.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities,
  author_id uuid not null references public.profiles on delete cascade,
  -- 'campus', or 'department:{id}' for a department's own feed.
  space text not null default 'campus'
    check (space = 'campus' or space ~ '^department:[0-9a-f-]{36}$'),
  body text not null check (char_length(body) between 1 and 2000),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 4),
  -- {"options": ["…", "…"]} with 2–4 options.
  poll jsonb check (poll is null or jsonb_array_length(poll -> 'options') between 2 and 4),
  is_anonymous boolean not null default false,
  upvotes int not null default 0,
  downvotes int not null default 0,
  comment_count int not null default 0,
  hot_score double precision not null default 0,
  status text not null default 'published' check (status in ('published', 'held', 'removed')),
  removed_at timestamptz
);
create index posts_hot_idx on public.posts (university_id, space, hot_score desc);
create index posts_new_idx on public.posts (university_id, space, created_at desc);
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.post_votes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (post_id, user_id)
);

create table public.poll_votes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  option smallint not null check (option between 0 and 3),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.posts on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  parent_id uuid references public.comments on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_anonymous boolean not null default false,
  status text not null default 'published' check (status in ('published', 'held', 'removed'))
);
create index comments_post_idx on public.comments (post_id, created_at);

-- A stable pseudonym per student per thread ("Kinnow #42").
create table public.anon_aliases (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  alias text not null,
  primary key (post_id, user_id),
  unique (post_id, alias)
);

alter table public.posts enable row level security;
alter table public.post_votes enable row level security;
alter table public.poll_votes enable row level security;
alter table public.comments enable row level security;
alter table public.anon_aliases enable row level security;
-- Base tables: moderators and admins only (§4.4). Students use the views below.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'moderator') and banned_at is null);
$$;
create policy posts_staff on public.posts for select to authenticated using ((select public.is_staff()));
create policy comments_staff on public.comments for select to authenticated using ((select public.is_staff()));
create policy post_votes_own on public.post_votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy poll_votes_own on public.poll_votes for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.posts, public.post_votes, public.poll_votes, public.comments,
  public.anon_aliases from anon, authenticated;
grant select on public.posts, public.comments, public.post_votes, public.poll_votes to authenticated;
grant all on public.posts, public.post_votes, public.poll_votes, public.comments,
  public.anon_aliases to service_role;

-- §4.7 hot score: sign·log10(max(|s|,1)) + (epoch − 2025-01-01) / 45000.
create or replace function public.hot_score(p_up int, p_down int, p_created timestamptz)
returns double precision
language sql immutable set search_path = '' as $$
  select sign((p_up - p_down)::double precision)
           * log(greatest(abs(p_up - p_down), 1)::double precision)
       + (extract(epoch from p_created)::double precision - 1735689600) / 45000;
$$;

create or replace function public.posts_hot_score() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.hot_score := public.hot_score(new.upvotes, new.downvotes, new.created_at);
  return new;
end;
$$;
create trigger posts_hot_score before insert or update of upvotes, downvotes on public.posts
  for each row execute function public.posts_hot_score();

-- Has the caller blocked, or been blocked by, this student? Caller-only (views need a
-- function students may execute; blocked_between(a, b) would let them probe others).
create or replace function public.blocked_with(p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.blocked_between(auth.uid(), p_other);
$$;

-- Can the caller see this space? Campus for everyone at the university; a department's
-- feed for its own students.
create or replace function public.can_see_space(p_university uuid, p_space text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles v
    where v.id = auth.uid() and v.verification_status = 'verified' and v.banned_at is null
      and v.deleted_at is null and v.university_id = p_university
      and (p_space = 'campus' or p_space = 'department:' || v.department_id::text)
  );
$$;

-- What students read. Anonymous posts carry an alias and author_id = null; is_mine says
-- whether the caller wrote it (so they can delete it) without revealing anyone else.
create view public.posts_public with (security_barrier = true) as
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
  ) end as poll_counts
from public.posts p
join public.profiles a on a.id = p.author_id
join public.privacy_settings s on s.user_id = a.id
left join public.anon_aliases al on al.post_id = p.id and al.user_id = p.author_id
where public.can_see_space(p.university_id, p.space)
  and (p.status = 'published' or (p.status = 'held' and p.author_id = auth.uid()))
  -- Blocks hide named posts both ways; anonymous ones too (without saying why).
  and not public.blocked_with(p.author_id);

create view public.comments_public with (security_barrier = true) as
select
  c.id, c.created_at, c.post_id, c.parent_id, c.body, c.is_anonymous, c.status,
  case when c.is_anonymous then null else c.author_id end as author_id,
  case when c.is_anonymous then null else a.handle::text end as author_handle,
  case when c.is_anonymous then al.alias else a.full_name end as author_name,
  case when not c.is_anonymous and public.visible_at(a.id, s.photo_visibility)
       then a.avatar_url end as author_avatar,
  c.author_id = auth.uid() as is_mine,
  -- "OP" marks the post's author in an anonymous thread without naming them.
  c.author_id = p.author_id as is_op
from public.comments c
join public.posts p on p.id = c.post_id
join public.profiles a on a.id = c.author_id
join public.privacy_settings s on s.user_id = a.id
left join public.anon_aliases al on al.post_id = c.post_id and al.user_id = c.author_id
where public.can_see_space(p.university_id, p.space)
  and p.status = 'published' and c.status = 'published'
  and not public.blocked_with(c.author_id);

revoke all on public.posts_public, public.comments_public from anon;
grant select on public.posts_public, public.comments_public to authenticated, service_role;

-- A stable alias for (post, student): a Sargodha-flavoured word and a number.
create or replace function public.alias_for(p_post uuid, p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_alias text;
  v_words text[] := array['Kinnow','Chai','Samosa','Jalebi','Pakora','Lassi','Paratha','Biryani',
    'Falooda','Rusk','Halwa','Kulfi','Chaat','Naan','Karahi','Sajji'];
begin
  select alias into v_alias from public.anon_aliases where post_id = p_post and user_id = p_user;
  if v_alias is not null then
    return v_alias;
  end if;
  loop
    v_alias := v_words[1 + floor(random() * array_length(v_words, 1))::int]
               || ' #' || (10 + floor(random() * 90))::int;
    begin
      insert into public.anon_aliases (post_id, user_id, alias) values (p_post, p_user, v_alias);
      return v_alias;
    exception when unique_violation then
      select alias into v_alias from public.anon_aliases where post_id = p_post and user_id = p_user;
      if v_alias is not null then
        return v_alias;
      end if;
    end;
  end loop;
end;
$$;

-- Write a post. Anonymous posting needs the feature flag and has a tighter daily limit.
create or replace function public.create_post(
  p_space text, p_body text, p_media text[] default '{}', p_poll jsonb default null,
  p_anonymous boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_uni uuid := public.my_university_id();
  v_id uuid;
  v_today int;
  v_limit int := 10;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not public.can_see_space(v_uni, p_space) then
    raise exception 'You can''t post there' using errcode = '42501';
  end if;
  if p_anonymous and not public.flag('anonymous_posts') then
    raise exception 'Anonymous posts are switched off' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_media, '{}')) m
             where m !~ '^posts/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)\Z') then
    raise exception 'Upload your photos again' using errcode = '22023';
  end if;
  select count(*) into v_today from public.posts
  where author_id = auth.uid() and created_at > now() - interval '1 day'
    and (not p_anonymous or is_anonymous);
  if p_anonymous then
    v_limit := 3;
  end if;
  if v_today >= v_limit then
    raise exception 'That''s enough posts for today. Try again tomorrow.' using errcode = '54000';
  end if;

  insert into public.posts (university_id, author_id, space, body, media_paths, poll, is_anonymous)
  values (v_uni, auth.uid(), p_space, trim(p_body), coalesce(p_media, '{}'), p_poll, p_anonymous)
  returning id into v_id;
  if p_anonymous then
    perform public.alias_for(v_id, auth.uid());
  end if;
  return v_id;
end;
$fn$;

-- Delete your own post (kept as 'removed' for moderation history).
create or replace function public.delete_post(p_post uuid) returns void
language sql security definer set search_path = '' as $$
  update public.posts set status = 'removed', removed_at = now()
  where id = p_post and author_id = auth.uid() and status <> 'removed';
$$;

-- Vote: 1, -1, or 0 to take a vote back. Keeps the counters and hot score in step.
create or replace function public.vote_post(p_post uuid, p_value int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old smallint;
begin
  if not exists (select 1 from public.posts_public where id = p_post and status = 'published') then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'Invalid vote' using errcode = '22023';
  end if;
  select value into v_old from public.post_votes where post_id = p_post and user_id = auth.uid();
  if p_value = 0 then
    delete from public.post_votes where post_id = p_post and user_id = auth.uid();
  else
    insert into public.post_votes (post_id, user_id, value) values (p_post, auth.uid(), p_value)
    on conflict (post_id, user_id) do update set value = excluded.value;
  end if;
  update public.posts set
    upvotes = upvotes - (coalesce(v_old, 0) = 1)::int + (p_value = 1)::int,
    downvotes = downvotes - (coalesce(v_old, 0) = -1)::int + (p_value = -1)::int
  where id = p_post;
end;
$$;

create or replace function public.vote_poll(p_post uuid, p_option int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_poll jsonb;
begin
  select poll into v_poll from public.posts_public where id = p_post and status = 'published';
  if v_poll is null then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;
  if p_option < 0 or p_option >= jsonb_array_length(v_poll -> 'options') then
    raise exception 'Pick one of the options' using errcode = '22023';
  end if;
  insert into public.poll_votes (post_id, user_id, option) values (p_post, auth.uid(), p_option)
  on conflict (post_id, user_id) do update set option = excluded.option;
end;
$$;

-- Comment (optionally anonymous, when allowed); notifies the post's author and the parent
-- comment's author. Anonymous comments notify without saying who.
create or replace function public.create_comment(
  p_post uuid, p_body text, p_parent uuid default null, p_anonymous boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_post public.posts;
  v_parent_author uuid;
  v_id uuid;
  v_actor uuid;
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.posts_public where id = p_post and status = 'published') then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_anonymous and not public.flag('anonymous_posts') then
    raise exception 'Anonymous comments are switched off' using errcode = '42501';
  end if;
  if (select count(*) from public.comments
      where author_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''re commenting very fast. Take a break.' using errcode = '54000';
  end if;
  select * into v_post from public.posts where id = p_post;
  if p_parent is not null then
    select author_id into v_parent_author from public.comments
    where id = p_parent and post_id = p_post and status = 'published';
    if v_parent_author is null then
      raise exception 'Comment not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.comments (post_id, author_id, parent_id, body, is_anonymous)
  values (p_post, auth.uid(), p_parent, trim(p_body), p_anonymous)
  returning id into v_id;
  update public.posts set comment_count = comment_count + 1 where id = p_post;
  if p_anonymous then
    perform public.alias_for(p_post, auth.uid());
  end if;

  v_actor := case when p_anonymous then null else auth.uid() end;
  perform public.notify(v_post.author_id, 'post.comment', v_actor, 'post', p_post,
                        jsonb_build_object('preview', left(trim(p_body), 80)));
  if v_parent_author is not null and v_parent_author <> v_post.author_id then
    perform public.notify(v_parent_author, 'comment.reply', v_actor, 'post', p_post,
                          jsonb_build_object('preview', left(trim(p_body), 80)));
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_comment(p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_post uuid;
begin
  update public.comments set status = 'removed'
  where id = p_comment and author_id = auth.uid() and status = 'published'
  returning post_id into v_post;
  if v_post is not null then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = v_post;
  end if;
end;
$$;

-- Reports hold content for moderators: anonymous posts after 2, named posts after 5.
create or replace function public.reports_hold_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_open int;
begin
  if new.target_type not in ('post', 'comment') then
    return new;
  end if;
  select count(*) into v_open from public.reports
  where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if new.target_type = 'post' then
    update public.posts set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  else
    update public.comments set status = 'held'
    where id = new.target_id and status = 'published'
      and v_open >= case when is_anonymous then 2 else 5 end;
  end if;
  return new;
end;
$$;
create trigger reports_hold_content after insert on public.reports
  for each row execute function public.reports_hold_content();

-- Students may report posts and comments they can see.
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
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, nullif(trim(p_details), ''))
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Post photos: private bucket, random names under posts/ (never the author's id, so an
-- anonymous post's photo can't give them away). Verified students can read.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy post_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (select public.is_verified())
              and name ~ '^posts/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy post_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (select public.is_verified()));

revoke execute on function public.alias_for(uuid, uuid), public.posts_hot_score(),
  public.reports_hold_content() from public, anon, authenticated;
revoke execute on function public.create_post(text, text, text[], jsonb, boolean),
  public.delete_post(uuid), public.vote_post(uuid, int), public.vote_poll(uuid, int),
  public.create_comment(uuid, text, uuid, boolean), public.delete_comment(uuid),
  public.can_see_space(uuid, text), public.is_staff(), public.hot_score(int, int, timestamptz),
  public.blocked_with(uuid)
  from public, anon;
grant execute on function public.create_post(text, text, text[], jsonb, boolean),
  public.delete_post(uuid), public.vote_post(uuid, int), public.vote_poll(uuid, int),
  public.create_comment(uuid, text, uuid, boolean), public.delete_comment(uuid),
  public.can_see_space(uuid, text), public.is_staff(), public.hot_score(int, int, timestamptz),
  public.blocked_with(uuid)
  to authenticated;
