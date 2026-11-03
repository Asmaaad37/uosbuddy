-- Phase 8: women-only rides are invisible and unjoinable for anyone not confirmed by an
-- admin; a ride's seats, chat and cancellation; listings; societies, events and reminders.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('Admin'), ('B'), ('C'), ('D'), ('W'), ('U');
create function tests.uid(p_name text) returns uuid language sql stable as $$
  select id from tests.u where name = p_name;
$$;
create function tests.as(p_name text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $$;
grant usage on schema tests to authenticated;
grant select on tests.u to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-campus@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set
  verification_status = case when u.name = 'U' then 'unverified' else 'verified' end::public.verification_status,
  onboarding_step = 4, department_id = (select id from public.departments where short_code = 'CS'),
  batch_year = 2024, role = case when u.name = 'Admin' then 'admin' else 'student' end::public.user_role
from tests.u u where p.id = u.id;

-- W asks for women-only access; the admin confirms.
select lives_ok($$ select tests.as('W', 'select public.request_women_only(''Girls hostel'')') $$,
  'a student can ask for women-only access');
select throws_ok($$ select tests.as('B', format('select public.decide_women_only(%L, true)', tests.uid('W'))) $$,
  '42501', null, 'only admins confirm women-only access');
select lives_ok($$ select tests.as('Admin', format('select public.decide_women_only(%L, true)', tests.uid('W'))) $$,
  'an admin confirms it');

-- ---------- women-only rides ----------
create temp table w_ride as select tests.as('W', $q$ select public.create_ride('offer', 'Main gate', 'Satellite Town',
  now() + interval '1 day', 3, '{}', true) $q$)::uuid as id;
grant select on w_ride to authenticated;
select is(tests.as('B', 'select count(*)::text from public.rides where women_only'), '0',
  'women-only rides are invisible to students not confirmed');
select is(tests.as('B', 'select count(*)::text from public.rides_board() where women_only'), '0',
  '…and missing from their ride board');
select throws_ok($$ select tests.as('B', format('select public.request_seat(%L)', (select id from w_ride))) $$,
  'P0002', null, '…and they can''t ask for a seat');
select throws_ok($$ select tests.as('B', $q$ select public.create_ride('offer', 'Main gate', 'Bhalwal',
  now() + interval '1 day', 2, '{}', true) $q$) $$,
  '42501', null, 'only confirmed students can post women-only rides');
select is(tests.as('W', 'select count(*)::text from public.rides where women_only'), '1',
  'a confirmed student sees women-only rides');
select is(tests.as('U', 'select count(*)::text from public.rides'), '0', 'unverified accounts see no rides');

-- ---------- a ride's life: request, accept (chat), full, withdraw, cancel ----------
create temp table d_ride as select tests.as('D', $q$ select public.create_ride('offer', 'Main gate', 'Lahore',
  now() + interval '2 days', 1, '{}', false, 'Leaving after the last class') $q$)::uuid as id;
grant select on d_ride to authenticated;
select lives_ok($$ select tests.as('B', format('select public.request_seat(%L, %L)', (select id from d_ride), 'Can I come?')) $$,
  'a student asks for a seat');
select is((select count(*)::text from public.notifications where user_id = tests.uid('D') and type = 'ride.request'),
  '1', 'the driver is notified');
create temp table b_conv as select tests.as('D', format('select public.respond_seat(%L, true)',
  (select id from public.ride_requests where ride_id = (select id from d_ride) and user_id = tests.uid('B'))))::uuid as id;
select ok(exists (select 1 from public.conversation_members
                  where conversation_id = (select id from b_conv) and user_id = tests.uid('B')),
  'accepting puts the rider in the ride''s group chat');
select is((select status from public.rides where id = (select id from d_ride)), 'full',
  'the ride is full when its seats are taken');
select throws_ok($$ select tests.as('C', format('select public.request_seat(%L)', (select id from d_ride))) $$,
  '22023', null, 'a full ride takes no more requests');
select lives_ok($$ select tests.as('B', format('select public.cancel_seat(%L)', (select id from d_ride))) $$,
  'the rider can withdraw');
select is((select status from public.rides where id = (select id from d_ride)) || ':' ||
          (select count(*)::text from public.conversation_members
           where conversation_id = (select id from b_conv) and user_id = tests.uid('B')),
  'open:0', 'withdrawing frees the seat and leaves the chat');

-- ---------- listings ----------
select lives_ok($$ select tests.as('B', $q$ select public.create_listing('sell', 'Casio fx-991', 'Like new', 2500) $q$) $$,
  'a student lists something for sale');
select is(tests.as('C', 'select count(*)::text from public.market_listings(''sell'')'), '1',
  'classmates see it in the market');
select throws_ok($$ select tests.as('B', $q$ select public.create_listing('lost', 'Blue umbrella', '', 100) $q$) $$,
  '22023', null, 'lost-and-found posts have no price');

-- ---------- societies and events ----------
create temp table soc as select tests.as('C', $q$ select public.create_society('Debating Society', 'debating', 'We argue.') $q$)::uuid as id;
grant select on soc to authenticated;
select is(tests.as('B', 'select count(*)::text from public.societies'), '0',
  'a society is hidden until an admin verifies it');
select throws_ok($$ select tests.as('C', format($q$ select public.create_event(%L, 'Trial', '', now() + interval '1 day',
  now() + interval '1 day 2 hours', 'Hall A') $q$, (select id from soc))) $$,
  '42501', null, 'unverified societies can''t post events');
select lives_ok($$ select tests.as('Admin', format('select public.verify_society(%L, true)', (select id from soc))) $$,
  'an admin verifies the society');
create temp table ev as select tests.as('C', format($q$ select public.create_event(%L, 'Open debate', 'All welcome',
  now() + interval '30 minutes', now() + interval '2 hours', 'Hall A', 1) $q$, (select id from soc)))::uuid as id;
grant select on ev to authenticated;
select lives_ok($$ select tests.as('B', format('select public.rsvp_event(%L, ''going'')', (select id from ev))) $$,
  'a student says they''re going');
select throws_ok($$ select tests.as('D', format('select public.rsvp_event(%L, ''going'')', (select id from ev))) $$,
  '22023', null, '"going" respects capacity');
select lives_ok('select public.event_reminders()', 'the reminder job runs');
select is((select count(*)::text from public.notifications
           where user_id = tests.uid('B') and type = 'event.reminder'), '1',
  'students going get a reminder within the hour before');

select * from finish();
rollback;
