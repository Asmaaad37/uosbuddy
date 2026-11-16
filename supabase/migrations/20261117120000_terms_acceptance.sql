-- Sign-up starts with "I agree to the Terms and Privacy Policy". Record when each student
-- agreed, and to which version (the date shown on the terms page).
alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text check (char_length(terms_version) <= 20);

-- Called once the account exists. Records a newer version too, so a later change of terms can
-- be accepted the same way.
create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_version is null or p_version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Unknown terms version' using errcode = '22023';
  end if;
  update public.profiles set terms_accepted_at = now(), terms_version = p_version
  where id = auth.uid() and terms_version is distinct from p_version;
end;
$$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
