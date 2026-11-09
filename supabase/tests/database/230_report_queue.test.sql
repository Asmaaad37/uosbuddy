-- Every kind of report reaches someone who can act on it. S sends, R reports, O isn't in the
-- chat, Mod moderates the campus feed, Admin sees everything.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('S'), ('R'), ('O'), ('Mod'), ('Admin');
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
select id, lower(name) || '-queue@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Queue ' || u.name, handle = 'queue_' || lower(u.name),
  role = case when u.name = 'Admin' then 'admin'::public.user_role else p.role end
from tests.u u where p.id = u.id;
insert into public.connections (requester_id, addressee_id, status)
values (tests.uid('S'), tests.uid('R'), 'accepted');
select lives_ok(format('select tests.as(''Admin'', %L)', format('select ''done'' from public.set_moderator(%L, array[''campus''])', tests.uid('Mod'))),
  'Mod moderates the campus feed');

-- A group chat with a text message and a photo.
create table tests.ids (name text primary key, id uuid);
grant select on tests.ids to authenticated;
create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.ids where name = p_name;
$$;
insert into tests.ids values ('group',
  tests.as('S', format('select public.create_group(''Study group'', null, array[%L]::uuid[])', tests.uid('R')))::uuid);
insert into tests.ids select 'text', (tests.as('S', format($q$ select (public.send_message(%L, 'Hello group')).id $q$, tests.id('group'))))::uuid;
insert into public.messages (id, conversation_id, sender_id, attachment_path)
values ('00000000-0000-0000-0000-00000000d001', tests.id('group'), tests.uid('S'), tests.id('group') || '/photo.jpg');
insert into tests.ids values ('photo', '00000000-0000-0000-0000-00000000d001');

create function tests.report(p_who text, p_type text, p_id uuid) returns text language sql as $$
  select tests.as(p_who, format('select ''done'' from public.report(%L, %L, ''harassment'')', p_type, p_id));
$$;
create function tests.queue(p_who text, p_type text, p_id uuid, p_col text) returns text language sql as $$
  select tests.as(p_who, format('select %s from public.moderation_queue() where target_type = %L and target_id = %L', p_col, p_type, p_id));
$$;

-- ---------- reported chats ----------
select throws_ok(format('select tests.report(''O'', ''conversation'', %L)', tests.id('group')), 'P0002', null,
  'you can''t report a chat you aren''t in');
select is(tests.report('R', 'conversation', tests.id('group')), 'done', 'a member can');
select is(tests.queue('Admin', 'conversation', tests.id('group'), 'report_count::text'), '1', 'it reaches the admin queue');
select ok(tests.queue('Admin', 'conversation', tests.id('group'), 'preview') like '%Queue S: Hello group%',
  'with its recent messages');
select is(tests.queue('Admin', 'conversation', tests.id('group'), 'media_paths[1]'), tests.id('group') || '/photo.jpg',
  'and photos');
select is(tests.queue('Mod', 'conversation', tests.id('group'), 'count(*)::text'), '0',
  'moderators don''t see chats');
select is(tests.queue('Admin', 'conversation', tests.id('group'), 'author_name'), 'Queue S', 'it names who started it');

-- ---------- reported photos ----------
select is(tests.report('R', 'message', tests.id('photo')), 'done', 'a photo can be reported');
select is(tests.queue('Admin', 'message', tests.id('photo'), 'media_bucket'), 'chat-attachments', 'staff are told where it is');
select is(tests.queue('Admin', 'message', tests.id('photo'), 'media_paths[1]'), tests.id('group') || '/photo.jpg', 'and which file');

-- ---------- removing a message ----------
create function tests.remove(p_who text, p_id uuid, p_action text default 'hide') returns text language sql as $$
  select tests.as(p_who, format('select ''done'' from public.moderate_content(''message'', %L, %L, ''harassment'')', p_id, p_action));
$$;
select throws_ok(format('select tests.remove(''R'', %L)', tests.id('photo')), '42501', null, 'students can''t remove messages');
select throws_ok(format('select tests.remove(''Mod'', %L)', tests.id('photo')), '42501', null, 'nor can moderators');
select is(tests.remove('Admin', tests.id('photo')), 'done', 'an admin can');
select is((select row(body, attachment_path, deleted_at is not null)::text from public.messages where id = tests.id('photo')),
  '(,,t)', 'it''s erased from the chat');
select is((select before ->> 'attachment_path' from public.audit_log where action = 'content.hide' and target_id = tests.id('photo')),
  tests.id('group') || '/photo.jpg', 'the audit log keeps a copy');
select is((select status::text from public.reports where target_type = 'message' and target_id = tests.id('photo')), 'actioned',
  'the report is closed');
select is((select count(*)::int from public.notifications where user_id = tests.uid('S') and type = 'content.removed'), 1,
  'the sender is told');
select throws_ok(format('select tests.remove(''Admin'', %L, ''restore'')', tests.id('photo')), '22023', null,
  'it can''t be restored');

-- ---------- rides and events ----------
insert into tests.ids values ('ride',
  tests.as('S', format('select public.create_ride(''offer'', ''Campus gate'', ''Lari Adda'', %L)', now() + interval '1 day'))::uuid);
insert into public.events (id, university_id, title, starts_at, ends_at, venue, created_by)
select '00000000-0000-0000-0000-00000000d002', university_id, 'Queue event', now() + interval '1 day', now() + interval '2 days', 'Main hall', tests.uid('S')
from public.profiles where id = tests.uid('S');
insert into tests.ids values ('event', '00000000-0000-0000-0000-00000000d002');
select is(tests.report('R', 'ride', tests.id('ride')), 'done', 'a ride can be reported');
select is(tests.queue('Admin', 'ride', tests.id('ride'), 'report_count::text'), '1', 'and reaches the queue');
select is(tests.report('R', 'event', tests.id('event')), 'done', 'an event can be reported');
select is(tests.queue('Admin', 'event', tests.id('event'), 'report_count::text'), '1', 'and reaches the queue');
select is(tests.as('Admin', format('select ''done'' from public.moderate_content(''ride'', %L, ''hide'')', tests.id('ride'))), 'done',
  'an admin can take a reported ride down');

select * from finish();
rollback;
