-- AI review: a question or timetable read that fails, or never reaches the model, gives the
-- student their go back. The app calls this with the service role after the failure; it is
-- not open to students, who could otherwise reset their own daily limit.
create or replace function public.refund_ai(p_user uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  update public.ai_usage set used = greatest(used - 1, 0)
  where user_id = p_user and kind = p_kind
    and day = (now() at time zone 'Asia/Karachi')::date;
$$;
revoke execute on function public.refund_ai(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_ai(uuid, text) to service_role;
