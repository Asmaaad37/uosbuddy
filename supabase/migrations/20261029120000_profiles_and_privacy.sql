-- Phase 2: interests, profile privacy (can_view_profile + profiles_public), avatars, handles.

-- ---------------------------------------------------------------------------
-- Interests (#10): a seeded list; students pick up to 10.
-- ---------------------------------------------------------------------------
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  label text not null,
  emoji text not null,
  category text not null,
  sort int not null default 0
);

create table public.profile_interests (
  user_id uuid not null references public.profiles on delete cascade,
  interest_id uuid not null references public.interests on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);
create index profile_interests_interest_idx on public.profile_interests (interest_id);

create or replace function public.limit_profile_interests() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Lock the owner's profile so two concurrent inserts can't both pass the count.
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.profile_interests where user_id = new.user_id) >= 10 then
    raise exception 'Pick up to 10 interests' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger profile_interests_limit
  before insert on public.profile_interests
  for each row execute function public.limit_profile_interests();

-- ---------------------------------------------------------------------------
-- Profile additions: which Opening Move prompt was answered (screen 8).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column opening_move_prompt text check (char_length(opening_move_prompt) <= 80);

-- A program must belong to the chosen department.
create or replace function public.check_profile_academic() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.program_id is not null and not exists (
    select 1 from public.programs where id = new.program_id and department_id = new.department_id
  ) then
    raise exception 'That program isn''t in your department' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger profiles_check_academic
  before insert or update of program_id, department_id on public.profiles
  for each row execute function public.check_profile_academic();

-- ---------------------------------------------------------------------------
-- Visibility (§4.4 can_view_profile). One rule for every level-gated field.
-- ---------------------------------------------------------------------------

-- Phase 4 replaces this with a lookup in `connections`; until then nobody is connected.
create or replace function public.are_connected(p_a uuid, p_b uuid) returns boolean
language sql stable set search_path = '' as $$
  select false;
$$;

-- Always for the caller (auth.uid()): taking a viewer argument would let anyone probe
-- whether two other students share a department or batch.
create or replace function public.visible_at(
  p_target uuid,
  p_level public.visibility_level
) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then false
    when auth.uid() = p_target then true
    else exists (
      select 1
      from public.profiles v
      join public.profiles t on t.id = p_target
      where v.id = auth.uid()
        and v.verification_status = 'verified' and v.banned_at is null and v.deleted_at is null
        and t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
        and v.university_id = t.university_id
        and case p_level
          when 'everyone' then true
          when 'department' then t.department_id is not null and v.department_id = t.department_id
          when 'batch' then t.department_id is not null and t.batch_year is not null
                            and v.department_id = t.department_id and v.batch_year = t.batch_year
          when 'connections' then public.are_connected(auth.uid(), p_target)
          else false
        end
    )
  end;
$$;

create or replace function public.can_view_profile(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.visible_at(
    p_target,
    coalesce((select profile_visibility from public.privacy_settings where user_id = p_target),
             'everyone'));
$$;

-- What other students may see of a profile: safe fields only, filtered and masked by the
-- owner's privacy settings. Owned by the migration role, so it reads the base tables itself;
-- the WHERE clause and CASE masks are the access control (security_barrier keeps
-- user-supplied predicates from running before them).
create view public.profiles_public with (security_barrier = true) as
select
  p.id,
  p.university_id,
  p.handle,
  p.full_name,
  case when public.visible_at(p.id, s.photo_visibility) then p.avatar_url end
    as avatar_url,
  p.department_id,
  p.program_id,
  p.batch_year,
  p.semester,
  p.section,
  p.shift,
  p.residence,
  case when s.show_hometown or p.id = auth.uid() then p.hometown_city end as hometown_city,
  p.bio,
  p.opening_move_prompt,
  p.opening_move,
  p.pronoun_display,
  p.is_mentor,
  p.verification_method = 'uni_email' as has_uni_email,
  p.verified_at
from public.profiles p
join public.privacy_settings s on s.user_id = p.id
where public.visible_at(p.id, s.profile_visibility);

-- The base table is now for the owner and admins only; everyone else goes through the view.
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Handles: available = well-formed and not taken (case-insensitively). Profanity and
-- reserved words are checked in the app (lib/validation/handle.ts).
-- ---------------------------------------------------------------------------
create or replace function public.handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_handle ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.profiles
       where handle = p_handle::extensions.citext and id is distinct from auth.uid()
     );
$$;

-- ---------------------------------------------------------------------------
-- Avatars: public bucket, {user_id}/{version}-{512|128}.webp, owners manage their folder.
-- Sized in the browser (image transformations need a paid Supabase plan).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- RLS and grants for the new objects.
-- ---------------------------------------------------------------------------
alter table public.interests enable row level security;
alter table public.profile_interests enable row level security;

create policy interests_read on public.interests for select to anon, authenticated using (true);
create policy interests_admin on public.interests for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy profile_interests_read on public.profile_interests for select to authenticated
  using (user_id = (select auth.uid())
         or (select public.is_admin())
         or public.can_view_profile(user_id));
create policy profile_interests_insert on public.profile_interests for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_verified()));
create policy profile_interests_delete on public.profile_interests for delete to authenticated
  using (user_id = (select auth.uid()));

-- Revoke first so local (grants everything by default) and hosted (grants nothing) match.
revoke all on public.interests, public.profile_interests, public.profiles_public from anon, authenticated;
grant select on public.interests to anon, authenticated;
grant insert, update, delete on public.interests to authenticated;
grant select, insert, delete on public.profile_interests to authenticated;
grant select on public.profiles_public to authenticated;
grant all on public.interests, public.profile_interests to service_role;
grant select on public.profiles_public to service_role;

revoke execute on function public.handle_available(text), public.can_view_profile(uuid),
  public.visible_at(uuid, public.visibility_level), public.are_connected(uuid, uuid)
  from public, anon;
grant execute on function public.handle_available(text), public.can_view_profile(uuid),
  public.visible_at(uuid, public.visibility_level), public.are_connected(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: interests (about 80, grouped for the picker).
-- ---------------------------------------------------------------------------
insert into public.interests (slug, label, emoji, category, sort)
select slug, label, emoji, category, row_number() over ()
from (values
  ('cricket', 'Cricket', '🏏', 'Sports'), ('football', 'Football', '⚽', 'Sports'),
  ('badminton', 'Badminton', '🏸', 'Sports'), ('table-tennis', 'Table tennis', '🏓', 'Sports'),
  ('volleyball', 'Volleyball', '🏐', 'Sports'), ('hockey', 'Hockey', '🏑', 'Sports'),
  ('basketball', 'Basketball', '🏀', 'Sports'), ('gym', 'Gym', '🏋️', 'Sports'),
  ('running', 'Running', '🏃', 'Sports'), ('cycling', 'Cycling', '🚴', 'Sports'),
  ('swimming', 'Swimming', '🏊', 'Sports'), ('martial-arts', 'Martial arts', '🥋', 'Sports'),
  ('chess', 'Chess', '♟️', 'Sports'), ('ludo', 'Ludo', '🎲', 'Sports'),

  ('coding', 'Coding', '💻', 'Tech'), ('web-dev', 'Web development', '🌐', 'Tech'),
  ('app-dev', 'App development', '📱', 'Tech'), ('ai-ml', 'AI and ML', '🤖', 'Tech'),
  ('data-science', 'Data science', '📊', 'Tech'), ('cyber-security', 'Cyber security', '🔐', 'Tech'),
  ('competitive-programming', 'Competitive programming', '🧮', 'Tech'),
  ('robotics', 'Robotics', '🦾', 'Tech'), ('electronics', 'Electronics', '🔌', 'Tech'),
  ('game-dev', 'Game development', '🕹️', 'Tech'), ('freelancing', 'Freelancing', '💼', 'Tech'),
  ('startups', 'Startups', '🚀', 'Tech'),

  ('design', 'Design', '🎨', 'Creative'), ('photography', 'Photography', '📷', 'Creative'),
  ('videography', 'Videography', '🎥', 'Creative'), ('painting', 'Painting', '🖌️', 'Creative'),
  ('calligraphy', 'Calligraphy', '✒️', 'Creative'), ('writing', 'Writing', '✍️', 'Creative'),
  ('poetry', 'Poetry / Shayari', '📜', 'Creative'), ('music', 'Music', '🎵', 'Creative'),
  ('singing', 'Singing', '🎤', 'Creative'), ('guitar', 'Guitar', '🎸', 'Creative'),
  ('theatre', 'Theatre and drama', '🎭', 'Creative'), ('content-creation', 'Content creation', '📲', 'Creative'),
  ('fashion', 'Fashion', '👗', 'Creative'), ('crafts', 'Crafts', '🧶', 'Creative'),

  ('books', 'Books', '📚', 'Learning'), ('debating', 'Debating', '🗣️', 'Learning'),
  ('public-speaking', 'Public speaking', '🎙️', 'Learning'), ('mun', 'Model UN', '🌍', 'Learning'),
  ('languages', 'Languages', '🈯', 'Learning'), ('history', 'History', '🏛️', 'Learning'),
  ('science', 'Science', '🔬', 'Learning'), ('maths', 'Maths', '➗', 'Learning'),
  ('economics', 'Economics', '📈', 'Learning'), ('politics', 'Politics', '🗳️', 'Learning'),
  ('psychology', 'Psychology', '🧠', 'Learning'), ('css-exams', 'CSS / competitive exams', '📝', 'Learning'),

  ('naats', 'Naats', '🕌', 'Faith and community'), ('quran', 'Quran study', '📖', 'Faith and community'),
  ('islamic-history', 'Islamic history', '🌙', 'Faith and community'),
  ('volunteering', 'Volunteering', '🤝', 'Faith and community'),
  ('blood-donation', 'Blood donation', '🩸', 'Faith and community'),
  ('environment', 'Environment', '🌱', 'Faith and community'),

  ('cooking', 'Cooking', '🍳', 'Lifestyle'), ('chai', 'Chai', '☕', 'Lifestyle'),
  ('foodie', 'Food spots', '🍔', 'Lifestyle'), ('travel', 'Travel', '🧳', 'Lifestyle'),
  ('hiking', 'Hiking', '🥾', 'Lifestyle'), ('gardening', 'Gardening', '🪴', 'Lifestyle'),
  ('pets', 'Pets', '🐈', 'Lifestyle'), ('fitness', 'Fitness', '💪', 'Lifestyle'),
  ('cars', 'Cars and bikes', '🏍️', 'Lifestyle'), ('entrepreneurship', 'Small business', '🛍️', 'Lifestyle'),

  ('gaming', 'Gaming', '🎮', 'Entertainment'), ('pubg', 'PUBG', '🔫', 'Entertainment'),
  ('anime', 'Anime', '🍥', 'Entertainment'), ('movies', 'Movies', '🎬', 'Entertainment'),
  ('dramas', 'Pakistani dramas', '📺', 'Entertainment'), ('series', 'Series', '🍿', 'Entertainment'),
  ('podcasts', 'Podcasts', '🎧', 'Entertainment'), ('memes', 'Memes', '😂', 'Entertainment'),
  ('kpop', 'K-pop and K-dramas', '🫰', 'Entertainment'), ('board-games', 'Board games', '🧩', 'Entertainment')
) as t(slug, label, emoji, category)
on conflict (slug) do nothing;
