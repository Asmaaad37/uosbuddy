-- Where the time goes, as one seeded student (run before k6 in load.yml).
\set ON_ERROR_STOP on
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'load-1@example.com'), 'role', 'authenticated')::text,
  false);
\timing on
select count(*) as feed_hot from public.feed_page('campus', 'hot');
select count(*) as feed_hot from public.feed_page('campus', 'hot');
select count(*) as feed_new from public.feed_page('campus', 'new');
explain (analyze, buffers, costs off)
  select * from public.posts_public
  where id = any (array(select id from public.posts where space = 'campus' order by hot_score desc limit 20));
set role authenticated;
explain (analyze, buffers, costs off)
  select id, body, created_at, sender_id from public.messages
  where conversation_id = '00000000-0000-0000-0000-00000000c0de' order by created_at desc limit 30;
reset role;
