-- Phase 3 (part 1): "Find your batch". Blocks, the batch directory, search and people
-- suggestions. The directory and suggestions apply the same privacy rule as visible_at()
-- but for a whole page of rows at once (visible_at runs per row, too slow for 30k
-- profiles); 050_discovery.test.sql checks they never show what profiles_public hides.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Blocks (§4.3). Created now because discovery must already hide blocked students;
-- Phase 4 adds the block/unblock UI. A block hides each student from the other.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));
revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;

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
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = v.id and b.blocked_id = t.id)
             or (b.blocker_id = t.id and b.blocked_id = v.id)
        )
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

-- ---------------------------------------------------------------------------
-- Indexes: name order for keyset pages, trigram search on names and handles.
-- ---------------------------------------------------------------------------
create index profiles_directory_name_idx
  on public.profiles (university_id, (lower(coalesce(full_name, handle::text))), id);
create index profiles_name_trgm_idx
  on public.profiles using gin (lower(full_name) extensions.gin_trgm_ops);
create index profiles_handle_trgm_idx
  on public.profiles using gin (lower(handle::text) extensions.gin_trgm_ops);
create index profiles_hometown_idx on public.profiles (university_id, (lower(hometown_city)));

-- ---------------------------------------------------------------------------
-- The directory row other students may see: masked like profiles_public.
-- ---------------------------------------------------------------------------
create type public.directory_person as (
  id uuid,
  handle text,
  full_name text,
  avatar_url text,
  department_code text,
  batch_year int,
  section text,
  shift public.shift_type,
  residence public.residence_type,
  hometown_city text,
  interests text[],
  has_uni_email boolean,
  sort_key text
);

-- One page of the directory for the caller. Scopes: 'section' (same department, batch,
-- section and shift), 'batch', 'department', 'all' (the whole university). `p_query`
-- searches names and handles; students who left the directory are found only by their
-- exact handle. Pages are keyset: pass the last row's sort_key and id.
create or replace function public.directory(
  p_scope text default 'batch',
  p_query text default null,
  p_shift public.shift_type default null,
  p_residence public.residence_type default null,
  p_hometown text default null,
  p_interest uuid default null,
  p_after_key text default null,
  p_after_id uuid default null,
  p_limit int default 30
) returns setof public.directory_person
language sql stable security definer set search_path = '' as $$
  with v as (
    select p.* from public.profiles p
    where p.id = auth.uid()
      and p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
  ),
  q as (
    select nullif(lower(trim(p_query)), '') as text
  )
  select
    t.id,
    t.handle::text,
    t.full_name,
    case when case s.photo_visibility
        when 'everyone' then true
        when 'department' then t.department_id = v.department_id
        when 'batch' then t.department_id = v.department_id and t.batch_year = v.batch_year
        when 'connections' then public.are_connected(v.id, t.id)
        else false
      end then t.avatar_url end,
    d.short_code,
    t.batch_year,
    t.section,
    t.shift,
    t.residence,
    case when s.show_hometown then t.hometown_city end,
    array(
      select i.label from public.profile_interests pi
      join public.interests i on i.id = pi.interest_id
      where pi.user_id = t.id order by i.sort limit 3
    ),
    exists (select 1 from public.private_profile pp where pp.user_id = t.id and pp.uni_email is not null),
    lower(coalesce(t.full_name, t.handle::text))
  from v
  cross join q
  join public.profiles t on t.university_id = v.university_id and t.id <> v.id
  join public.privacy_settings s on s.user_id = t.id
  left join public.departments d on d.id = t.department_id
  where t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
    and t.onboarding_step >= 4
    -- Privacy: the same rule as visible_at(), for the whole page at once.
    and case s.profile_visibility
      when 'everyone' then true
      when 'department' then t.department_id = v.department_id
      when 'batch' then t.department_id = v.department_id and t.batch_year = v.batch_year
      when 'connections' then public.are_connected(v.id, t.id)
      else false
    end
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v.id and b.blocked_id = t.id) or (b.blocker_id = t.id and b.blocked_id = v.id)
    )
    and (s.show_in_directory or (q.text is not null and lower(t.handle::text) = ltrim(q.text, '@')))
    -- Scope
    and case p_scope
      when 'section' then v.section is not null and t.department_id = v.department_id
                          and t.batch_year = v.batch_year and t.section = v.section
                          and t.shift is not distinct from v.shift
      when 'batch' then t.department_id = v.department_id and t.batch_year = v.batch_year
      when 'department' then t.department_id = v.department_id
      when 'all' then true
      else false
    end
    -- Search and filters
    and (q.text is null
         or lower(t.full_name) like '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%'
         or lower(t.handle::text) like replace(replace(replace(ltrim(q.text, '@'), '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (p_shift is null or t.shift = p_shift)
    and (p_residence is null or t.residence = p_residence)
    and (p_hometown is null or (s.show_hometown and lower(t.hometown_city) = lower(trim(p_hometown))))
    and (p_interest is null or exists (
      select 1 from public.profile_interests pi where pi.user_id = t.id and pi.interest_id = p_interest))
    -- Keyset pagination
    and (p_after_key is null
         or (lower(coalesce(t.full_name, t.handle::text)), t.id) > (p_after_key, p_after_id))
  order by lower(coalesce(t.full_name, t.handle::text)), t.id
  limit least(greatest(p_limit, 1), 50);
$$;

-- How many of the caller's section, batch and department are here (the batch reveal),
-- counting only students the caller could find in the directory.
create or replace function public.directory_counts()
returns table (section_count int, batch_count int, department_count int, university_count int)
language sql stable security definer set search_path = '' as $$
  with v as (
    select p.* from public.profiles p
    where p.id = auth.uid()
      and p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
  ),
  seen as (
    select
      v.section is not null and t.department_id = v.department_id and t.batch_year = v.batch_year
        and t.section = v.section and t.shift is not distinct from v.shift as in_section,
      t.department_id = v.department_id and t.batch_year = v.batch_year as in_batch,
      t.department_id = v.department_id as in_department
    from v
    join public.profiles t on t.university_id = v.university_id and t.id <> v.id
    join public.privacy_settings s on s.user_id = t.id
    where t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
      and t.onboarding_step >= 4 and s.show_in_directory
      and case s.profile_visibility
        when 'everyone' then true
        when 'department' then t.department_id = v.department_id
        when 'batch' then t.department_id = v.department_id and t.batch_year = v.batch_year
        when 'connections' then public.are_connected(v.id, t.id)
        else false
      end
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v.id and b.blocked_id = t.id) or (b.blocker_id = t.id and b.blocked_id = v.id)
      )
  )
  select
    (count(*) filter (where in_section))::int,
    (count(*) filter (where in_batch))::int,
    (count(*) filter (where in_department))::int,
    count(*)::int
  from seen;
$$;

-- ---------------------------------------------------------------------------
-- People suggestions (§4.7). Shared courses and mutual connections join the score once
-- those exist (Phases 4–5). Reasons come strongest first; the app caps any one top
-- reason at 40% of the list and caches it per student.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_people(p_limit int default 20, p_offset int default 0)
returns table (person public.directory_person, score numeric, reasons text[])
language sql stable security definer set search_path = '' as $$
  with v as (
    select p.*, array(select interest_id from public.profile_interests where user_id = p.id) as mine
    from public.profiles p
    where p.id = auth.uid()
      and p.verification_status = 'verified' and p.banned_at is null and p.deleted_at is null
  ),
  c as (
    select t.*, s.show_hometown, s.photo_visibility,
      array(select interest_id from public.profile_interests where user_id = t.id) as theirs,
      t.department_id = v.department_id as same_dept,
      t.department_id = v.department_id and t.batch_year = v.batch_year as same_batch,
      t.department_id = v.department_id and t.batch_year = v.batch_year
        and v.section is not null and t.section = v.section
        and t.shift is not distinct from v.shift as same_section,
      s.show_hometown and v.hometown_city is not null
        and lower(t.hometown_city) = lower(v.hometown_city) as same_hometown,
      v.residence = 'hostelite' and t.residence = 'hostelite' as both_hostelite,
      t.last_active_at > now() - interval '7 days' as recently_active
    from v
    join public.profiles t on t.university_id = v.university_id and t.id <> v.id
    join public.privacy_settings s on s.user_id = t.id
    where t.verification_status = 'verified' and t.banned_at is null and t.deleted_at is null
      and t.onboarding_step >= 4 and s.show_in_directory
      and case s.profile_visibility
        when 'everyone' then true
        when 'department' then t.department_id = v.department_id
        when 'batch' then t.department_id = v.department_id and t.batch_year = v.batch_year
        when 'connections' then public.are_connected(v.id, t.id)
        else false
      end
      and not public.are_connected(v.id, t.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v.id and b.blocked_id = t.id) or (b.blocker_id = t.id and b.blocked_id = v.id)
      )
  ),
  scored as (
    select c.*,
      (select count(*) from unnest(c.theirs) x where x = any(v.mine)) as shared,
      cardinality(array(select unnest(c.theirs) union select unnest(v.mine))) as either,
      (select i.label from public.interests i
        where i.id = any(c.theirs) and i.id = any(v.mine) order by i.sort limit 1) as shared_label,
      v.department_id as v_dept, v.batch_year as v_batch, v.hometown_city as v_home
    from c cross join v
  )
  select
    row(
      sc.id, sc.handle::text, sc.full_name,
      case when case sc.photo_visibility
          when 'everyone' then true
          when 'department' then sc.department_id = sc.v_dept
          when 'batch' then sc.department_id = sc.v_dept and sc.batch_year = sc.v_batch
          when 'connections' then false
          else false
        end then sc.avatar_url end,
      (select short_code from public.departments where id = sc.department_id),
      sc.batch_year, sc.section, sc.shift, sc.residence,
      case when sc.show_hometown then sc.hometown_city end,
      array(select i.label from public.interests i where i.id = any(sc.theirs) order by i.sort limit 3),
      exists (select 1 from public.private_profile pp where pp.user_id = sc.id and pp.uni_email is not null),
      lower(coalesce(sc.full_name, sc.handle::text))
    )::public.directory_person,
    round((
        3.0 * sc.same_batch::int + 2.5 * sc.same_section::int + 2.0 * sc.same_dept::int
      + 1.2 * case when sc.either > 0 then sc.shared::numeric / sc.either else 0 end
      + 1.0 * sc.same_hometown::int + 0.5 * sc.both_hostelite::int
      + 0.3 * coalesce(sc.recently_active, false)::int
    )::numeric, 3) as score,
    array_remove(array[
      case when sc.same_section then 'Same section'
           when sc.same_batch then 'Same batch'
           when sc.same_dept then 'Same department' end,
      case when sc.shared_label is not null then 'Both into ' || sc.shared_label end,
      case when sc.same_hometown then 'Also from ' || sc.hometown_city end,
      case when sc.both_hostelite then 'Also a hostelite' end
    ], null) as reasons
  from scored sc
  order by score desc, sc.id
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

revoke execute on function public.directory(text, text, public.shift_type, public.residence_type, text, uuid, text, uuid, int) from public, anon;
revoke execute on function public.directory_counts() from public, anon;
revoke execute on function public.suggest_people(int, int) from public, anon;
grant execute on function public.directory(text, text, public.shift_type, public.residence_type, text, uuid, text, uuid, int) to authenticated;
grant execute on function public.directory_counts() to authenticated;
grant execute on function public.suggest_people(int, int) to authenticated;
