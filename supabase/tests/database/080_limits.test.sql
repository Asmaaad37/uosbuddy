-- Phase 4 rate limits live in the database, so calling the functions directly can't skip
-- them; and the blocked list shows only your own blocks.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) select 'S' || g from generate_series(0, 32) g;
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
create function tests.login(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-lim@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  handle = 'lim_' || lower(u.name)
from tests.u u where p.id = u.id;

-- ---------- messages: 60 a minute ----------
select tests.login('S0');
create temp table c as select public.start_dm(tests.uid('S1')) as id;
select lives_ok($$ select count(public.send_message((select id from c), 'msg ' || g)) from generate_series(1, 60) g $$,
  '60 messages in a minute are fine');
select throws_ok($$ select public.send_message((select id from c), 'one too many') $$, '54000', null,
  'the 61st within a minute is refused');
reset role;

-- ---------- connection requests: 30 a day ----------
select tests.login('S0');
select lives_ok($$ select count(public.request_connection(tests.uid('S' || g))) from generate_series(2, 31) g $$,
  '30 requests in a day are fine');
select throws_ok($$ select public.request_connection(tests.uid('S32')) $$, '54000', null,
  'the 31st in a day is refused');
reset role;

-- ---------- blocked list ----------
select tests.login('S1');
select public.block_user(tests.uid('S2'));
select is((select string_agg(handle, ',') from public.my_blocked()), 'lim_s2', 'you see whom you blocked');
reset role;
select tests.login('S2');
select is((select count(*)::int from public.my_blocked()), 0, 'the blocked student does not see it');
reset role;

select * from finish();
rollback;
