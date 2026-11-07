-- Mute on posts (redesign §5.2 #4). Muting a student hides their named posts from your
-- feeds; hiding a post hides just that one (the only option on anonymous posts). Both are
-- private: the other student is never told, and nothing else changes (you can still open
-- their profile, chat, or a link to a post).
--
-- A mute never hides anonymous posts: if one vanished after you muted someone, you would
-- learn who wrote it.

create table public.mutes (
  muter_id uuid not null references public.profiles on delete cascade,
  muted_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create table public.hidden_posts (
  user_id uuid not null references public.profiles on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.mutes enable row level security;
alter table public.hidden_posts enable row level security;
-- Your own rows only, read through the functions below; nobody can see who muted them.
revoke all on public.mutes, public.hidden_posts from anon, authenticated;
grant all on public.mutes, public.hidden_posts to service_role;

-- Mute (true) or unmute (false) a student. Returns the new state.
create or replace function public.set_mute(p_target uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_target = auth.uid() then
    raise exception 'You can''t mute yourself' using errcode = '22023';
  end if;
  if p_on then
    if not exists (select 1 from public.profiles where id = p_target) then
      raise exception 'Student not found' using errcode = 'P0002';
    end if;
    insert into public.mutes (muter_id, muted_id) values (auth.uid(), p_target)
    on conflict do nothing;
  else
    delete from public.mutes where muter_id = auth.uid() and muted_id = p_target;
  end if;
  return p_on;
end;
$$;

-- Hide (true) or unhide (false) one post from your feeds.
create or replace function public.set_post_hidden(p_post uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if p_on then
    if not exists (select 1 from public.posts_public where id = p_post) then
      raise exception 'Post not found' using errcode = 'P0002';
    end if;
    insert into public.hidden_posts (user_id, post_id) values (auth.uid(), p_post)
    on conflict do nothing;
  else
    delete from public.hidden_posts where user_id = auth.uid() and post_id = p_post;
  end if;
  return p_on;
end;
$$;

-- The students you've muted, for Me → Muted (only what their privacy lets you see).
create or replace function public.my_mutes()
returns table (user_id uuid, full_name text, handle text, avatar_url text, muted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.handle::text, public.shown_avatar(p.id), m.created_at
  from public.mutes m join public.profiles p on p.id = m.muted_id
  where m.muter_id = auth.uid() and p.deleted_at is null
  order by m.created_at desc;
$$;

-- feed_page (from 20261106100000) with two more checks: posts you hid, and named posts by
-- students you muted.
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
        and not exists (select 1 from public.hidden_posts h
                        where h.user_id = v_me and h.post_id = p.id)
        and (p.is_anonymous or not exists (select 1 from public.mutes m
                                           where m.muter_id = v_me and m.muted_id = p.author_id))
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
        and not exists (select 1 from public.hidden_posts h
                        where h.user_id = v_me and h.post_id = p.id)
        and (p.is_anonymous or not exists (select 1 from public.mutes m
                                           where m.muter_id = v_me and m.muted_id = p.author_id))
      order by p.hot_score desc, p.id desc
      limit v_limit) page;
    return query select v.* from public.posts_public v where v.id = any (v_ids)
      order by v.hot_score desc, v.id desc;
  end if;
end;
$fn$;

revoke execute on function public.set_mute(uuid, boolean), public.set_post_hidden(uuid, boolean),
  public.my_mutes() from public, anon;
grant execute on function public.set_mute(uuid, boolean), public.set_post_hidden(uuid, boolean),
  public.my_mutes() to authenticated;
