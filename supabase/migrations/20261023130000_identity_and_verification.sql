-- Phase 1: tenant catalogue, identity, verification and audit log (BUILD_PLAN §4.2–4.5).
-- Functions use `search_path = ''`, so every name is schema-qualified.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (§4.2). All of them now, so later phases don't need enum migrations.
-- ---------------------------------------------------------------------------
create type public.verification_status as enum ('unverified','pending','verified','rejected','needs_info');
create type public.verification_method as enum ('uni_email','document','admin_manual');
create type public.user_role as enum ('student','moderator','admin');
create type public.shift_type as enum ('morning','evening','weekend');
create type public.residence_type as enum ('day_scholar','hostelite','other');
create type public.program_level as enum ('associate','bs','bs_5th_semester','ms_mphil','phd','other');
create type public.connection_status as enum ('pending','accepted','declined','blocked');
create type public.visibility_level as enum ('everyone','department','batch','connections','nobody');
create type public.backup_status as enum ('open','claimed','resolved','expired','cancelled');
create type public.report_status as enum ('open','actioned','dismissed');
create type public.ride_role as enum ('driver','passenger');
create type public.listing_kind as enum ('sell','buy','free','lost','found');
create type public.conversation_kind as enum ('dm','group','batch','course','backup_temp');

-- ---------------------------------------------------------------------------
-- Tenant and catalogue
-- ---------------------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  city text,
  roll_no_regex text,
  registration_no_regex text,
  is_live boolean not null default false
);

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities on delete cascade,
  name text not null,
  is_main boolean not null default false,
  unique (university_id, name)
);

create table public.university_domains (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities on delete cascade,
  campus_id uuid references public.campuses on delete set null,
  domain extensions.citext not null unique,
  student_only boolean not null default true,
  mail_host text not null default 'other' check (mail_host in ('google','microsoft','other')),
  returning_only boolean not null default false
);

-- Kill switch (#76): when a host isn't live, the UI hides its OAuth button and offers email OTP.
create table public.auth_providers (
  mail_host text primary key check (mail_host in ('google','microsoft','other')),
  live boolean not null default true
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  university_id uuid not null references public.universities on delete cascade,
  campus_id uuid references public.campuses on delete set null,
  name text not null,
  short_code text not null,
  faculty text,
  aliases text[] not null default '{}',
  unique (university_id, short_code)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  department_id uuid not null references public.departments on delete cascade,
  name text not null,
  level public.program_level not null,
  duration_semesters int not null check (duration_semesters between 1 and 12),
  unique (department_id, name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  department_id uuid not null references public.departments on delete cascade,
  code text not null,
  title text not null,
  credit_hours smallint check (credit_hours between 0 and 6),
  semester_hint smallint check (semester_hint between 1 and 12),
  unique (department_id, code)
);

create table public.university_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  email extensions.citext not null check (char_length(email) <= 254 and email like '%_@_%')
);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  university_id uuid references public.universities,
  handle extensions.citext unique check (handle::text ~ '^[A-Za-z0-9_]{3,20}$'),
  full_name text check (char_length(full_name) between 1 and 80),
  avatar_url text,
  department_id uuid references public.departments,
  program_id uuid references public.programs,
  batch_year int check (batch_year between 1990 and 2100),
  semester int check (semester between 1 and 12),
  section text check (char_length(section) <= 10),
  shift public.shift_type,
  residence public.residence_type,
  hometown_city text check (char_length(hometown_city) <= 60),
  bio text check (char_length(bio) <= 280),
  opening_move text check (char_length(opening_move) <= 200),
  pronoun_display text check (char_length(pronoun_display) <= 30),
  role public.user_role not null default 'student',
  is_mentor boolean not null default false,
  verification_status public.verification_status not null default 'unverified',
  verification_method public.verification_method,
  verified_at timestamptz,
  banned_at timestamptz,
  deleted_at timestamptz,
  onboarding_step int not null default 0,
  last_active_at timestamptz
);
create index profiles_directory_idx on public.profiles (department_id, batch_year, section, shift);

-- PII: readable by self and admins only; written only by security-definer functions.
create table public.private_profile (
  user_id uuid primary key references public.profiles on delete cascade,
  roll_no text,
  registration_no text,
  whatsapp text,
  personal_email extensions.citext,
  uni_email extensions.citext
);

create table public.privacy_settings (
  user_id uuid primary key references public.profiles on delete cascade,
  profile_visibility public.visibility_level not null default 'everyone',
  photo_visibility public.visibility_level not null default 'batch',
  show_hometown boolean not null default true,
  show_in_directory boolean not null default true,
  allow_dms_from public.visibility_level not null default 'everyone',
  show_free_now boolean not null default false,
  women_only_spaces boolean not null default false
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles on delete cascade,
  university_id uuid not null references public.universities,
  method public.verification_method not null default 'document',
  status public.verification_status not null default 'pending',
  doc_path text,
  roll_no_submitted text,
  full_name_submitted text,
  ai_precheck jsonb,
  reviewer_id uuid references public.profiles on delete set null,
  decision_reason text,
  decided_at timestamptz,
  doc_deleted_at timestamptz
);
-- At most one open request per user; resubmitting updates it.
create unique index verification_requests_open_uq
  on public.verification_requests (user_id) where status in ('pending','needs_info');
create index verification_requests_queue_idx on public.verification_requests (status, created_at);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  before jsonb,
  after jsonb
);
create index audit_log_target_idx on public.audit_log (target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (§4.4)
-- ---------------------------------------------------------------------------
create or replace function public.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p
    where p.id = auth.uid() and p.verification_status = 'verified'
      and p.banned_at is null and p.deleted_at is null);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and banned_at is null);
$$;

-- Avoids a recursive policy on profiles when comparing universities.
create or replace function public.my_university_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select university_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Protected columns: only admins and server-side code may change these.
-- Not security definer on purpose: current_user is the caller's role, so
-- 'authenticated' means a browser session; definer functions run as their owner.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin()
     and (new.role, new.verification_status, new.verification_method, new.verified_at,
          new.banned_at, new.university_id, new.is_mentor)
         is distinct from
         (old.role, old.verification_status, old.verification_method, old.verified_at,
          old.banned_at, old.university_id, old.is_mentor) then
    raise exception 'Only an admin can change role, verification or ban fields'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Sign-up: create the profile rows, then verify instantly when a confirmed
-- email belongs to the university's domain (§3.3 A). Google sets
-- email_confirmed_at at creation; email OTP sets it on first sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.apply_uni_email(p_user uuid, p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_domain extensions.citext := split_part(lower(p_email), '@', 2);
begin
  if p_email is null or not exists (
    select 1 from public.university_domains d
    join public.profiles p on p.university_id = d.university_id
    where p.id = p_user and d.domain = v_domain
  ) then
    return false;
  end if;

  update public.private_profile
     set uni_email = p_email, personal_email = nullif(personal_email, p_email::extensions.citext)
   where user_id = p_user;
  update public.profiles
     set verification_status = 'verified', verification_method = 'uni_email', verified_at = now()
   where id = p_user and verification_status <> 'verified' and banned_at is null;
  -- A uni email supersedes any document still waiting for review.
  update public.verification_requests
     set status = 'verified', decision_reason = 'Verified by university email',
         decided_at = now(), updated_at = now()
   where user_id = p_user and status in ('pending','needs_info');
  return true;
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_university uuid;
  v_name text := nullif(left(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), 80), '');
begin
  -- Single tenant at launch; multi-university picks this from sign-up metadata.
  select id into v_university from public.universities where slug = 'uos';

  insert into public.profiles (id, university_id, full_name) values (new.id, v_university, v_name);
  insert into public.private_profile (user_id) values (new.id);
  insert into public.privacy_settings (user_id) values (new.id);

  if new.email_confirmed_at is null or not public.apply_uni_email(new.id, new.email) then
    update public.private_profile set personal_email = new.email where user_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.apply_uni_email(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row
  when (new.email_confirmed_at is not null
        and (old.email_confirmed_at is null or old.email is distinct from new.email))
  execute function public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- Document verification (§3.3 B, §4.5)
-- ---------------------------------------------------------------------------
create or replace function public.submit_verification(
  p_full_name text,
  p_roll_no text,
  p_doc_path text,
  p_whatsapp text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_uni public.universities;
  v_name text := btrim(p_full_name);
  v_roll text := upper(regexp_replace(coalesce(p_roll_no, ''), '\s', '', 'g'));
  v_phone text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[\s()-]', '', 'g'), '');
  v_is_roll boolean;
  v_request uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.banned_at is not null then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;
  if v_profile.verification_status = 'verified' then
    raise exception 'You are already verified' using errcode = 'P0001';
  end if;

  select * into v_uni from public.universities where id = v_profile.university_id;

  if char_length(v_name) not between 2 and 80 then
    raise exception 'Enter your full name' using errcode = '22023';
  end if;
  -- coalesce: a missing regex must reject, not compare to NULL and slip through.
  v_is_roll := coalesce(v_roll ~ v_uni.roll_no_regex, false);
  if not (v_is_roll or coalesce(v_roll ~ v_uni.registration_no_regex, false)) then
    raise exception 'That does not look like a roll or registration number' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{10,13}$' then
    raise exception 'Enter a valid WhatsApp number' using errcode = '22023';
  end if;
  if p_doc_path is null or split_part(p_doc_path, '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects
                    where bucket_id = 'verification-docs' and name = p_doc_path) then
    raise exception 'Upload your proof document first' using errcode = '22023';
  end if;

  -- Resubmitting (edit, needs_info, or after a rejection) reuses the open request.
  update public.verification_requests
     set status = 'pending', doc_path = p_doc_path, roll_no_submitted = v_roll,
         full_name_submitted = v_name, ai_precheck = null, updated_at = now()
   where user_id = v_uid and status in ('pending','needs_info')
  returning id into v_request;

  if v_request is null then
    insert into public.verification_requests
      (user_id, university_id, method, status, doc_path, roll_no_submitted, full_name_submitted)
    values (v_uid, v_profile.university_id, 'document', 'pending', p_doc_path, v_roll, v_name)
    returning id into v_request;
  end if;

  update public.profiles
     set verification_status = 'pending', full_name = coalesce(full_name, v_name)
   where id = v_uid;
  update public.private_profile
     set roll_no = case when v_is_roll then v_roll else roll_no end,
         registration_no = case when v_is_roll then registration_no else v_roll end,
         whatsapp = coalesce(v_phone, whatsapp)
   where user_id = v_uid;

  return v_request;
end;
$$;

create or replace function public.decide_verification(
  p_request uuid,
  p_decision public.verification_status,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.verification_requests;
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review verifications' using errcode = '42501';
  end if;
  if p_decision not in ('verified','rejected','needs_info') then
    raise exception 'Decision must be verified, rejected or needs_info' using errcode = '22023';
  end if;
  if p_decision <> 'verified' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give the student a reason' using errcode = '22023';
  end if;

  select * into v_request from public.verification_requests where id = p_request for update;
  if v_request.id is null or v_request.status <> 'pending' then
    raise exception 'This request is no longer pending' using errcode = 'P0001';
  end if;
  v_before := to_jsonb(v_request);

  update public.verification_requests
     set status = p_decision, reviewer_id = auth.uid(), decision_reason = nullif(btrim(p_reason), ''),
         decided_at = now(), updated_at = now()
   where id = p_request
  returning * into v_request;

  update public.profiles
     set verification_status = p_decision,
         verification_method = case when p_decision = 'verified' then 'document'::public.verification_method
                                    else verification_method end,
         verified_at = case when p_decision = 'verified' then now() else verified_at end
   where id = v_request.user_id and verification_status <> 'verified';

  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (auth.uid(), 'verification.' || p_decision, 'verification_request', p_request,
          v_before, to_jsonb(v_request));
end;
$$;

revoke execute on function public.submit_verification(text, text, text, text) from public, anon;
grant execute on function public.submit_verification(text, text, text, text) to authenticated;
revoke execute on function public.decide_verification(uuid, public.verification_status, text) from public, anon;
grant execute on function public.decide_verification(uuid, public.verification_status, text) to authenticated;
revoke execute on function public.apply_uni_email(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_confirmed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.universities enable row level security;
alter table public.campuses enable row level security;
alter table public.university_domains enable row level security;
alter table public.auth_providers enable row level security;
alter table public.departments enable row level security;
alter table public.programs enable row level security;
alter table public.courses enable row level security;
alter table public.university_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.private_profile enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.verification_requests enable row level security;
alter table public.audit_log enable row level security;

-- Catalogue: public reads (onboarding runs before sign-in); admin writes.
create policy universities_read on public.universities for select to anon, authenticated using (true);
create policy campuses_read on public.campuses for select to anon, authenticated using (true);
create policy university_domains_read on public.university_domains for select to anon, authenticated using (true);
create policy auth_providers_read on public.auth_providers for select to anon, authenticated using (true);
create policy departments_read on public.departments for select to anon, authenticated using (true);
create policy programs_read on public.programs for select to anon, authenticated using (true);
create policy courses_read on public.courses for select to anon, authenticated using (true);

create policy universities_admin on public.universities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy campuses_admin on public.campuses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy university_domains_admin on public.university_domains for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy auth_providers_admin on public.auth_providers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy departments_admin on public.departments for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy programs_admin on public.programs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy courses_admin on public.courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Waitlist: anyone can join (rate-limited in the app); only admins read it.
create policy university_requests_insert on public.university_requests for insert to anon, authenticated
  with check (true);
create policy university_requests_admin_read on public.university_requests for select to authenticated
  using ((select public.is_admin()));

-- Profiles. Privacy settings (can_view_profile) arrive in Phase 2 and blocks in Phase 4.
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select public.is_admin())
  or ((select public.is_verified())
      and university_id = (select public.my_university_id())
      and verification_status = 'verified' and banned_at is null and deleted_at is null)
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy private_profile_read on public.private_profile for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy privacy_settings_read on public.privacy_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy privacy_settings_update on public.privacy_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy verification_requests_read on public.verification_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy audit_log_admin_read on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage: verification documents. Path: {user_id}/{uuid}.{ext}.
-- Owners upload into their own folder; only admins read. Max 8 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 8388608,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy verification_docs_owner_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy verification_docs_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and (select public.is_admin()));
