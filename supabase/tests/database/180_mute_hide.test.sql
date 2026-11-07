-- Mute and hide on the feed. A, B, C are verified CS 2024 students. B posts once by name
-- and once anonymously; C posts once by name.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create schema tests;
create table tests.u (name text primary key, id uuid not null default gen_random_uuid());
insert into tests.u (name) values ('A'), ('B'), ('C');
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
create function tests.feed(p_name text) returns text language sql as $$
  select tests.as(p_name,
    $q$ select coalesce(string_agg(body, ', ' order by body), '') from public.feed_page('campus', 'new') $q$);
$$;
create function tests.post(p_body text) returns uuid language sql stable as $$
  select id from public.posts where body = p_body;
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role)
select id, lower(name) || '-mute@example.com', now(), 'authenticated', 'authenticated' from tests.u;
update public.profiles p set verification_status = 'verified', onboarding_step = 4,
  university_id = (select university_id from public.departments where short_code = 'CS'),
  department_id = (select id from public.departments where short_code = 'CS'), batch_year = 2024,
  full_name = 'Mute ' || u.name, handle = 'mute_' || lower(u.name)
from tests.u u where p.id = u.id;

insert into public.posts (university_id, author_id, space, body, is_anonymous)
select (select university_id from public.departments where short_code = 'CS'), tests.uid(w), 'campus', b, anon
from (values ('B', 'B named', false), ('B', 'B anon', true), ('C', 'C named', false)) v(w, b, anon);

select is(has_function_privilege('anon', 'public.set_mute(uuid, boolean)', 'execute'), false,
  'signed-out visitors cannot mute');
select is(has_table_privilege('authenticated', 'public.mutes', 'select'), false,
  'nobody reads the mutes table directly (so nobody learns who muted them)');
select is(tests.feed('A'), 'B anon, B named, C named', 'A sees all three posts');

select is(tests.as('A', format('select public.set_mute(%L, true)::text', tests.uid('B'))), 'true',
  'A mutes B');
select is(tests.feed('A'), 'B anon, C named',
  'B''s named post leaves A''s feed; the anonymous one stays (hiding it would reveal the author)');
select is(tests.feed('B'), 'B anon, B named, C named', 'B''s own feed is unchanged');
select is(tests.as('B', 'select count(*)::text from public.my_mutes()'), '0',
  'B cannot tell they were muted');
select is(tests.as('A', 'select string_agg(full_name, '', '') from public.my_mutes()'), 'Mute B',
  'A sees B in Me → Muted');
select throws_ok($$ select tests.as('A', format('select public.set_mute(%L, true)::text', tests.uid('A'))) $$,
  '22023', null, 'you can''t mute yourself');

select is(tests.as('A', format('select public.set_post_hidden(%L, true)::text', tests.post('C named'))), 'true',
  'A hides C''s post');
select tests.as('A', format('select public.set_post_hidden(%L, true)::text', tests.post('B anon')));
select is(tests.feed('A'), '', 'and the anonymous one: A''s feed is empty');
select is(tests.feed('C'), 'B anon, B named, C named', 'C still sees everything');

select tests.as('A', format('select public.set_mute(%L, false)::text', tests.uid('B')));
select is(tests.feed('A'), 'B named', 'unmuting B brings B''s named post back');
select tests.as('A', format('select public.set_post_hidden(%L, false)::text', tests.post('C named')));
select is(tests.feed('A'), 'B named, C named', 'unhiding brings C''s post back');

select * from finish();
rollback;
