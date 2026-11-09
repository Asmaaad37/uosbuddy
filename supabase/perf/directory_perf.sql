-- Phase 3 performance check: directory pages stay under 300 ms at p95 with 30,000 seeded
-- students (BUILD_PLAN Phase 3 tests). Seeds inside a transaction and rolls back, so it
-- leaves nothing behind. CI runs it after the pgTAP suite:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/perf/directory_perf.sql
\set ON_ERROR_STOP on
\timing off
begin;

-- ---------- seed 30,000 students ----------
create temp table seed_names (kind text, i int, v text);
insert into seed_names
select 'first', ordinality::int, v from unnest(array[
  'Ali','Ahmed','Usman','Hamza','Bilal','Saad','Hassan','Hussain','Zain','Umar','Abdullah','Fahad',
  'Talha','Haris','Asad','Imran','Waqas','Danish','Ayesha','Fatima','Zainab','Maryam','Hira','Sana',
  'Iqra','Amna','Mahnoor','Areeba','Khadija','Rabia','Noor','Laiba','Aiman','Mehwish','Saima','Kinza'
]) with ordinality as t(v)
union all
select 'last', ordinality::int, v from unnest(array[
  'Khan','Ahmed','Ali','Hussain','Malik','Butt','Chaudhry','Sheikh','Qureshi','Raza','Siddiqui',
  'Iqbal','Akhtar','Javed','Shah','Mirza','Anwar','Aslam','Nawaz','Tariq','Rehman','Bhatti','Gondal'
]) with ordinality as t(v)
union all
select 'city', ordinality::int, v from unnest(array[
  'Sargodha','Lahore','Faisalabad','Khushab','Mianwali','Jhang','Bhalwal','Chiniot','Gujranwala',
  'Rawalpindi','Multan','Bhakkar'
]) with ordinality as t(v);

insert into auth.users (id, email, email_confirmed_at, aud, role)
select gen_random_uuid(), 'perf-' || g || '@example.com', now(), 'authenticated', 'authenticated'
from generate_series(1, 30000) g;

create temp table people as
select p.id, row_number() over (order by p.id)::int as n,
  -- Weighted towards the first few departments, like the real university.
  1 + floor(power(random(), 2) * (select count(*) from public.departments))::int as dept_n
from public.profiles p join auth.users u on u.id = p.id
where u.email like 'perf-%@example.com';

with depts as (select id, row_number() over (order by short_code)::int as n from public.departments)
update public.profiles p set
  verification_status = 'verified',
  verification_method = 'document',
  verified_at = now(),
  full_name = (select v from seed_names where kind = 'first' and i = 1 + (people.n * 7) % 36)
    || ' ' || (select v from seed_names where kind = 'last' and i = 1 + (people.n * 13) % 23),
  handle = 'perf_' || people.n,
  department_id = (select id from depts where depts.n = people.dept_n),
  batch_year = 2020 + (people.n % 6),
  semester = 1 + (people.n % 8),
  section = (array['REG','SS1','SS2'])[1 + (people.n / 6) % 3],
  shift = (array['morning','morning','evening'])[1 + people.n % 3]::public.shift_type,
  residence = (array['day_scholar','hostelite','day_scholar'])[1 + people.n % 3]::public.residence_type,
  hometown_city = (select v from seed_names where kind = 'city' and i = 1 + (people.n * 5) % 12),
  onboarding_step = 4
from people where p.id = people.id;

-- Three interests each.
with ints as (select id, row_number() over (order by sort)::int as r, count(*) over ()::int as c
              from public.interests)
insert into public.profile_interests (user_id, interest_id)
select people.id, ints.id
from people join ints
  on ints.r in (1 + people.n % ints.c, 1 + (people.n * 3 + 1) % ints.c, 1 + (people.n * 7 + 2) % ints.c)
on conflict do nothing;

-- A tenth hide from the directory; a tenth show only to their batch.
update public.privacy_settings s set show_in_directory = false
from people where s.user_id = people.id and people.n % 10 = 0;
update public.privacy_settings s set profile_visibility = 'batch'
from people where s.user_id = people.id and people.n % 10 = 5;

analyze public.profiles;
analyze public.privacy_settings;
analyze public.profile_interests;

-- ---------- measure as one student from the biggest department, CS-style ----------
create temp table timings (label text, ms numeric);
grant select, insert on timings to authenticated;

do $$
declare
  v_viewer uuid;
  v_interest uuid := (select id from public.interests order by sort limit 1);
  v_t timestamptz;
  v_key text;
  v_id uuid;
  v_scope text;
begin
  select p.id into v_viewer
  from public.profiles p join people on people.id = p.id
  where p.batch_year = 2024 and p.section = 'SS1'
    and p.department_id = (select department_id from public.profiles p2 join people using (id)
                           group by department_id order by count(*) desc limit 1)
  limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_viewer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  for i in 1..25 loop
    foreach v_scope in array array['section', 'batch', 'department', 'all'] loop
      v_t := clock_timestamp();
      perform count(*) from public.directory(v_scope);
      insert into timings values (v_scope, extract(epoch from clock_timestamp() - v_t) * 1000);
    end loop;

    v_t := clock_timestamp();
    perform count(*) from public.directory('all', 'ali');
    insert into timings values ('search', extract(epoch from clock_timestamp() - v_t) * 1000);

    v_t := clock_timestamp();
    perform count(*) from public.directory('all', p_hometown => 'Lahore');
    insert into timings values ('hometown', extract(epoch from clock_timestamp() - v_t) * 1000);

    v_t := clock_timestamp();
    perform count(*) from public.directory('department', p_interest => v_interest);
    insert into timings values ('interest', extract(epoch from clock_timestamp() - v_t) * 1000);

    -- A deep page: the 31st–60th of all UoS.
    select sort_key, id into v_key, v_id from public.directory('all') offset 29 limit 1;
    v_t := clock_timestamp();
    perform count(*) from public.directory('all', p_after_key => v_key, p_after_id => v_id);
    insert into timings values ('next page', extract(epoch from clock_timestamp() - v_t) * 1000);
  end loop;

  -- Reported, not gated: counts load once per hub visit, suggestions are cached for 15 min.
  for i in 1..5 loop
    v_t := clock_timestamp();
    perform * from public.directory_counts();
    insert into timings values ('counts (info)', extract(epoch from clock_timestamp() - v_t) * 1000);
    v_t := clock_timestamp();
    perform count(*) from public.suggest_people(50);
    insert into timings values ('suggestions (info)', extract(epoch from clock_timestamp() - v_t) * 1000);
  end loop;

  execute 'reset role';
end $$;

select label,
  count(*) as runs,
  round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as p50_ms,
  round(percentile_cont(0.95) within group (order by ms)::numeric, 1) as p95_ms
from timings group by label order by label;

do $$
declare
  v_p95 numeric;
begin
  select percentile_cont(0.95) within group (order by ms) into v_p95
  from timings where label not like '%(info)';
  raise notice 'Directory p95 across all queries: % ms (budget 300 ms)', round(v_p95, 1);
  if v_p95 > 300 then
    raise exception 'Directory p95 is % ms, over the 300 ms budget', round(v_p95, 1);
  end if;
end $$;

rollback;
