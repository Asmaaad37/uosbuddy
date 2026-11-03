-- Phase 7 (part 1): the AI layer's data. Course-file excerpts with embeddings (gte-small,
-- 384 dimensions, computed by a Supabase Edge Function) and full-text vectors for hybrid
-- search; AI Buddy threads and messages; per-student daily AI quotas; and signed
-- moderation decisions, so a post can't skip moderation by calling create_post directly.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ===========================================================================
-- Excerpts of course files (students search them only through the function below)
-- ===========================================================================
alter table public.resources
  add column if not exists index_status text not null default 'pending'
    check (index_status in ('pending', 'indexed', 'failed', 'skipped')),
  add column if not exists chunk_count int not null default 0;

create table public.resource_chunks (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  chunk_index int not null,
  page int,
  content text not null check (char_length(content) between 1 and 4000),
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  embedding extensions.vector(384),
  unique (resource_id, chunk_index)
);
create index resource_chunks_course_idx on public.resource_chunks (course_id);
create index resource_chunks_fts_idx on public.resource_chunks using gin (fts);
create index resource_chunks_embedding_idx on public.resource_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
alter table public.resource_chunks enable row level security;
revoke all on public.resource_chunks from anon, authenticated;
grant all on public.resource_chunks to service_role;

-- Hybrid search (Phase 7 task 1): the 20 nearest by meaning and the 20 best by keywords,
-- merged with reciprocal rank fusion, top k. Only published files of the requested
-- course, and only for verified students at that course's university.
create or replace function public.search_course_chunks(
  p_course uuid,
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_k int default 6
) returns table (chunk_id uuid, resource_id uuid, resource_title text, resource_kind text,
                 page int, content text, score double precision)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select 1 as ok
    where public.is_verified() and exists (
      select 1 from public.courses c join public.departments d on d.id = c.department_id
      where c.id = p_course and d.university_id = public.my_university_id())
  ),
  usable as (
    select ch.* from public.resource_chunks ch
    join public.resources r on r.id = ch.resource_id
    where ch.course_id = p_course and r.status = 'published' and exists (select 1 from allowed)
  ),
  by_meaning as (
    select u.id, row_number() over (order by u.embedding operator(extensions.<=>) p_embedding) as rnk
    from usable u
    where p_embedding is not null and u.embedding is not null
    order by u.embedding operator(extensions.<=>) p_embedding
    limit 20
  ),
  by_words as (
    select u.id, row_number() over (order by ts_rank(u.fts, q) desc) as rnk
    from usable u, websearch_to_tsquery('english', coalesce(p_query, '')) q
    where u.fts @@ q
    order by ts_rank(u.fts, q) desc
    limit 20
  ),
  fused as (
    select id, sum(1.0 / (60 + rnk)) as score
    from (select * from by_meaning union all select * from by_words) x
    group by id
  )
  select ch.id, ch.resource_id, r.title, r.kind, ch.page, ch.content, f.score::double precision
  from fused f
  join public.resource_chunks ch on ch.id = f.id
  join public.resources r on r.id = ch.resource_id
  order by f.score desc, ch.id
  limit least(greatest(p_k, 1), 10);
$$;

-- ===========================================================================
-- AI Buddy threads and messages (each student's own)
-- ===========================================================================
create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null default 'New chat' check (char_length(title) between 1 and 80)
);
create index ai_threads_user_idx on public.ai_threads (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  thread_id uuid not null references public.ai_threads on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  sources jsonb not null default '[]',
  tokens_in int,
  tokens_out int
);
create index ai_messages_thread_idx on public.ai_messages (thread_id, created_at);

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
create policy ai_threads_own on public.ai_threads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_messages_own on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = (select auth.uid())));
revoke all on public.ai_threads, public.ai_messages from anon, authenticated;
grant select, insert, update, delete on public.ai_threads, public.ai_messages to authenticated;
grant all on public.ai_threads, public.ai_messages to service_role;

-- ===========================================================================
-- Daily AI quotas per student (Pakistan days). Limits live here, not in the request.
-- ===========================================================================
create table public.ai_usage (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  kind text not null,
  used int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

create or replace function public.ai_limit(p_kind text) returns int
language sql immutable set search_path = '' as $$
  select case p_kind when 'buddy' then 30 when 'timetable' then 10 else 0 end;
$$;

-- Uses one of today's AI requests; returns how many are left. Out of quota: errcode 54000.
create or replace function public.use_ai(p_kind text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Karachi')::date;
  v_used int;
  v_what text := 'timetable imports';
begin
  if not public.is_verified() then
    raise exception 'You need to be verified first' using errcode = '42501';
  end if;
  if public.ai_limit(p_kind) = 0 then
    raise exception 'Unknown AI feature' using errcode = '22023';
  end if;
  insert into public.ai_usage (user_id, day, kind, used) values (auth.uid(), v_day, p_kind, 1)
  on conflict (user_id, day, kind) do update set used = public.ai_usage.used + 1
  returning used into v_used;
  if v_used > public.ai_limit(p_kind) then
    if p_kind = 'buddy' then
      v_what := 'AI Buddy questions';
    end if;
    raise exception 'That''s all your % for today. It resets at midnight.', v_what
      using errcode = '54000';
  end if;
  return public.ai_limit(p_kind) - v_used;
end;
$$;

create or replace function public.ai_remaining(p_kind text) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(public.ai_limit(p_kind) - coalesce((
    select used from public.ai_usage
    where user_id = auth.uid() and kind = p_kind
      and day = (now() at time zone 'Asia/Karachi')::date), 0), 0);
$$;

-- ===========================================================================
-- Signed moderation decisions. When app_private.config has 'moderation_secret', posts and
-- comments need a token the server made after moderating that exact text:
-- hex(hmac_sha256("{user}:{md5(body)}:{status}", secret)). Without the secret (local
-- development, CI) moderation is skipped.
-- ===========================================================================
create or replace function public.moderation_status(p_body text, p_token text, p_status text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
begin
  select value into v_secret from app_private.config where key = 'moderation_secret';
  if v_secret is null then
    return 'published';
  end if;
  if p_status not in ('published', 'held') or p_token is null
     or p_token <> encode(extensions.hmac(auth.uid()::text || ':' || md5(p_body) || ':' || p_status,
                                           v_secret, 'sha256'), 'hex') then
    raise exception 'Post again from the app' using errcode = '42501';
  end if;
  return p_status;
end;
$$;
revoke execute on function public.moderation_status(text, text, text) from public, anon, authenticated;

drop function if exists public.create_post(text, text, text[], jsonb, boolean);
create or replace function public.create_post(
  p_space text, p_body text, p_media text[] default '{}', p_poll jsonb default null,
  p_anonymous boolean default false, p_mod_token text default null, p_mod_status text default 'published'
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_uni uuid := public.my_university_id();
  v_id uuid;
  v_today int;
  v_limit int := 10;
  v_status text;
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
  v_status := public.moderation_status(p_body, p_mod_token, p_mod_status);
  select count(*) into v_today from public.posts
  where author_id = auth.uid() and created_at > now() - interval '1 day'
    and (not p_anonymous or is_anonymous);
  if p_anonymous then
    v_limit := 3;
  end if;
  if v_today >= v_limit then
    raise exception 'That''s enough posts for today. Try again tomorrow.' using errcode = '54000';
  end if;

  insert into public.posts (university_id, author_id, space, body, media_paths, poll, is_anonymous, status)
  values (v_uni, auth.uid(), p_space, trim(p_body), coalesce(p_media, '{}'), p_poll, p_anonymous, v_status)
  returning id into v_id;
  if p_anonymous then
    perform public.alias_for(v_id, auth.uid());
  end if;
  return v_id;
end;
$fn$;

drop function if exists public.create_comment(uuid, text, uuid, boolean);
create or replace function public.create_comment(
  p_post uuid, p_body text, p_parent uuid default null, p_anonymous boolean default false,
  p_mod_token text default null, p_mod_status text default 'published'
) returns uuid
language plpgsql security definer set search_path = '' as $fn$
declare
  v_post public.posts;
  v_parent_author uuid;
  v_id uuid;
  v_actor uuid;
  v_status text;
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
  v_status := public.moderation_status(p_body, p_mod_token, p_mod_status);
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

  insert into public.comments (post_id, author_id, parent_id, body, is_anonymous, status)
  values (p_post, auth.uid(), p_parent, trim(p_body), p_anonymous, v_status)
  returning id into v_id;
  if v_status <> 'published' then
    return v_id;
  end if;
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
$fn$;

-- ===========================================================================
-- Grants
-- ===========================================================================
revoke execute on function public.search_course_chunks(uuid, text, extensions.vector, int),
  public.use_ai(text), public.ai_remaining(text), public.ai_limit(text),
  public.create_post(text, text, text[], jsonb, boolean, text, text),
  public.create_comment(uuid, text, uuid, boolean, text, text)
from public, anon;
grant execute on function public.search_course_chunks(uuid, text, extensions.vector, int),
  public.use_ai(text), public.ai_remaining(text), public.ai_limit(text),
  public.create_post(text, text, text[], jsonb, boolean, text, text),
  public.create_comment(uuid, text, uuid, boolean, text, text)
to authenticated;
