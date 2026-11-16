-- C1: claimed Backup requests expire and both people hear. C3: recurring rides end; a
-- cancelled or finished ride's chat closes; leaving a ride's chat gives up the seat.
-- C4: group owners and admins rename, add and remove; a group outlives its owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('R'), ('H'), ('D'), ('B'), ('O'), ('M1'), ('M2'), ('X'), ('N');
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
create table tests.ids (name text primary key, id uuid);
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
grant usage on schema tests to authenticated;
grant select on tests.u, tests.ids to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-c134@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Tidy ' || u.name, handle = 'tidy_' || lower(u.name)
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status) values
  (tests.uid('O'), tests.uid('M1'), 'accepted'), (tests.uid('O'), tests.uid('M2'), 'accepted'),
  (tests.uid('O'), tests.uid('X'), 'accepted');

-- ---------- C1: a claimed request nobody finishes ----------
insert into tests.ids values ('stale', tests.as('R', $q$ select public.create_backup('Need a calculator', null, 'item') $q$)::uuid);
insert into tests.ids values ('fresh', tests.as('R', $q$ select public.create_backup('Need lab notes', null, 'notes') $q$)::uuid);
insert into tests.ids values ('stale_chat', tests.as('H', format('select public.claim_backup(%L)', tests.id('stale')))::uuid);
select tests.as('H', format('select public.claim_backup(%L)::text', tests.id('fresh')));
select tests.as('R', $q$ select public.create_backup('Need a stapler', null, 'item')::text $q$);
select throws_ok($$ select tests.as('R', $q$ select public.create_backup('Need a pen', null, 'item')::text $q$) $$,
  '54000', null, 'three open requests is the limit');
update public.backup_requests set claimed_at = now() - interval '73 hours' where id = tests.id('stale');
select public.backup_housekeeping();

select is((select status::text from public.backup_requests where id = tests.id('stale')), 'expired',
  'a request claimed over 72 hours ago expires');
select is((select status::text from public.backup_requests where id = tests.id('fresh')), 'claimed',
  'a recent claim is left alone');
select is((select count(*)::int from public.notifications
           where type = 'backup.expired' and entity_id = tests.id('stale')
             and user_id in (tests.uid('R'), tests.uid('H'))), 2,
  'both the requester and the helper are told');
select ok((select expires_at > now() from public.conversations where id = tests.id('stale_chat')),
  'their chat stays readable for a while');
select lives_ok($$ select tests.as('R', $q$ select public.create_backup('Need a ride', null, 'ride')::text $q$) $$,
  'once a claim expires, it no longer counts toward the 3 open');

-- ---------- C3: recurring rides end ----------
select throws_ok($$ select tests.as('D', $q$ select public.create_ride('offer', 'Main gate', 'Bhalwal',
    now() + interval '1 day', 2, '{0,2}', false, null, current_date + 200)::text $q$) $$,
  '22023', null, 'a recurring ride ends within 4 months');
insert into tests.ids values ('weekly', tests.as('D', $q$ select public.create_ride('offer', 'Main gate', 'Sargodha city',
    now() + interval '1 day', 2, '{1,3}')::text $q$)::uuid);
select ok((select recurring_until is not null from public.rides where id = tests.id('weekly')),
  'a recurring ride without an end date gets one');
update public.rides set recurring_until = public.pk_today() - 1 where id = tests.id('weekly');
select is(tests.as('B', format('select count(*)::text from public.rides_board() where id = %L', tests.id('weekly'))), '0',
  'a recurring ride past its last day leaves the board');
select throws_ok(format('select tests.as(%L, %L)', 'B', format('select public.request_seat(%L)', tests.id('weekly'))),
  '22023', null, '…and takes no requests');

-- ---------- C3: leaving a ride's chat gives up the seat ----------
insert into tests.ids values ('lift', tests.as('D', $q$ select public.create_ride('offer', 'Main gate', 'Lahore',
    now() + interval '2 days', 1)::text $q$)::uuid);
select tests.as('B', format('select public.request_seat(%L)', tests.id('lift')));
insert into tests.ids values ('lift_chat', tests.as('D', format('select public.respond_seat(%L, true)',
  (select id from public.ride_requests where ride_id = tests.id('lift') and user_id = tests.uid('B'))))::uuid);
select is((select status from public.rides where id = tests.id('lift')), 'full', 'the one seat is taken');
select throws_ok(format('select tests.as(%L, %L)', 'D', format('select public.leave_conversation(%L)', tests.id('lift_chat'))),
  '22023', null, 'the poster can''t walk out of their own ride''s chat');
select tests.as('B', format('select public.leave_conversation(%L)', tests.id('lift_chat')));
select is((select q.status || ':' || r.status from public.ride_requests q join public.rides r on r.id = q.ride_id
           where q.ride_id = tests.id('lift') and q.user_id = tests.uid('B')), 'cancelled:open',
  'a rider who leaves the chat gives up the seat, and the ride opens again');
select is((select count(*)::int from public.notifications where user_id = tests.uid('D') and type = 'ride.left'), 1,
  'the poster is told');

-- ---------- C3: cancelling closes the chat ----------
select tests.as('D', format('select public.cancel_ride(%L)', tests.id('lift')));
select ok((select expires_at is not null from public.conversations where id = tests.id('lift_chat')),
  'cancelling a ride closes its chat');
-- Inside one transaction now() never moves; in real life the next message comes later.
update public.conversations set expires_at = expires_at - interval '1 minute' where id = tests.id('lift_chat');
select throws_ok(format('select tests.as(%L, %L)', 'D', format('select (public.send_message(%L, %L)).body', tests.id('lift_chat'), 'Anyone?')),
  '42501', 'This chat has ended', 'a cancelled ride''s chat takes no new messages');

-- ---------- C3: a finished ride's chat closes ----------
insert into tests.ids values ('old', tests.as('D', $q$ select public.create_ride('offer', 'Main gate', 'Jhang',
    now() + interval '1 hour', 2)::text $q$)::uuid);
select tests.as('B', format('select public.request_seat(%L)', tests.id('old')));
insert into tests.ids values ('old_chat', tests.as('D', format('select public.respond_seat(%L, true)',
  (select id from public.ride_requests where ride_id = tests.id('old') and user_id = tests.uid('B'))))::uuid);
update public.rides set depart_at = now() - interval '2 days' where id = tests.id('old');
select public.rides_housekeeping();
select ok((select expires_at <= now() from public.conversations where id = tests.id('old_chat')),
  'a ride''s chat closes a day after it leaves');

-- ---------- C4: managing a group ----------
insert into tests.ids values ('grp', tests.as('O', format('select public.create_group(%L, %L, %L)',
  'Study squad', '📚', array[tests.uid('M1'), tests.uid('M2')]))::uuid);
select throws_ok(format('select tests.as(%L, %L)', 'M1', format('select public.remove_group_member(%L, %L)', tests.id('grp'), tests.uid('M2'))),
  '42501', null, 'members can''t remove people');
select tests.as('O', format('select public.remove_group_member(%L, %L)', tests.id('grp'), tests.uid('M2')));
select is((select count(*)::int from public.conversation_members where conversation_id = tests.id('grp') and user_id = tests.uid('M2')), 0,
  'the owner removes someone');
select tests.as('O', format('select public.add_group_members(%L, %L)', tests.id('grp'), array[tests.uid('X')]));
-- Everything here happens at the same instant; X joined later in real life.
update public.conversation_members set joined_at = now() + interval '1 minute'
where conversation_id = tests.id('grp') and user_id = tests.uid('X');
select is((select count(*)::int from public.conversation_members where conversation_id = tests.id('grp')), 3,
  'the owner adds a connection');
select throws_ok(format('select tests.as(%L, %L)', 'O', format('select public.add_group_members(%L, %L)', tests.id('grp'), array[tests.uid('N')])),
  '42501', null, 'but only connections');
select throws_ok(format('select tests.as(%L, %L)', 'M1', format('select public.rename_group(%L, %L, null)', tests.id('grp'), 'Mine now')),
  '42501', null, 'members can''t rename the group');
select tests.as('O', format('select public.rename_group(%L, %L, %L)', tests.id('grp'), 'Finals crew', '🔥'));
select is((select title || ' ' || emoji from public.conversations where id = tests.id('grp')), 'Finals crew 🔥',
  'the owner renames it');
select tests.as('O', format('select public.leave_conversation(%L)', tests.id('grp')));
select is((select role from public.conversation_members where conversation_id = tests.id('grp') and user_id = tests.uid('M1')), 'owner',
  'when the owner leaves, the longest-standing member takes over');
select throws_ok(format('select tests.as(%L, %L)', 'D', format('select public.add_group_members(%L, %L)', tests.id('old_chat'), array[tests.uid('B')])),
  '42501', null, 'ride chats can''t be managed like groups');

select * from finish();
rollback;
