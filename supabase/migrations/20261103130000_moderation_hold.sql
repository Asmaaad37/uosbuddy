-- Phase 7: before the database has a moderation secret, still honour "held" from the app.
-- Holding only ever hides the author's own post, so it needs no signature.
create or replace function public.moderation_status(p_body text, p_token text, p_status text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
begin
  select value into v_secret from app_private.config where key = 'moderation_secret';
  if v_secret is null then
    if p_status = 'held' then
      return 'held';
    end if;
    return 'published';
  end if;
  if p_status not in ('published', 'held') or p_token is null
     or p_token <> encode(extensions.hmac(auth.uid()::text || ':' || md5(p_body) || ':' || p_status,
                                           v_secret, 'sha256'), 'hex') then
    raise exception 'Post again from the app' using errcode = '42501';
  end if;
  return p_status;
end;
$$;
revoke execute on function public.moderation_status(text, text, text) from public, anon, authenticated;
