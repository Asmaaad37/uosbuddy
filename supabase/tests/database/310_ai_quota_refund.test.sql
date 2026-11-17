-- AI review: a failed AI request gives the student their go back, but only the app (service
-- role) can do that; a student can't reset their own daily limit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, email_confirmed_at, aud, role)
values ('00000000-0000-0000-0000-0000000a1001', 'refund@example.com', now(), 'authenticated', 'authenticated');
update public.profiles set verification_status = 'verified', onboarding_step = 4
where id = '00000000-0000-0000-0000-0000000a1001';
insert into public.ai_usage (user_id, day, kind, used)
values ('00000000-0000-0000-0000-0000000a1001', (now() at time zone 'Asia/Karachi')::date, 'buddy', 2);

select is(has_function_privilege('authenticated', 'public.refund_ai(uuid, text)', 'execute'), false,
  'students can''t give themselves quota back');
select is(has_function_privilege('service_role', 'public.refund_ai(uuid, text)', 'execute'), true,
  'the app can');

select public.refund_ai('00000000-0000-0000-0000-0000000a1001', 'buddy');
select is((select used from public.ai_usage where user_id = '00000000-0000-0000-0000-0000000a1001'), 1,
  'a refund gives one question back');
select public.refund_ai('00000000-0000-0000-0000-0000000a1001', 'buddy');
select public.refund_ai('00000000-0000-0000-0000-0000000a1001', 'buddy');
select is((select used from public.ai_usage where user_id = '00000000-0000-0000-0000-0000000a1001'), 0,
  'and never goes below zero');

select * from finish();
rollback;
