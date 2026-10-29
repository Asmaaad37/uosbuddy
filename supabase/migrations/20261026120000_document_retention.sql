-- Verification documents are deleted 30 days after review (§3.3 B step 6, §3.6 point 10).
-- Storage files can only be deleted through the Storage API, so this function only decides
-- which files are due; /api/cron/purge-documents deletes them and stamps doc_deleted_at.

create or replace function public.expired_verification_documents(
  p_days int default 30,
  p_limit int default 500
) returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'verification-docs'
    and o.created_at < now() - make_interval(days => p_days)
    -- Keep a file while its request is open, or until it was decided p_days ago. Everything
    -- else (decided long ago, replaced by a resubmission, never submitted) is due.
    and not exists (
      select 1 from public.verification_requests r
      where r.doc_path = o.name
        and (r.status in ('pending', 'needs_info')
             or r.decided_at > now() - make_interval(days => p_days))
    )
  order by o.created_at
  limit p_limit;
$$;

revoke execute on function public.expired_verification_documents(int, int) from public, anon, authenticated;
grant execute on function public.expired_verification_documents(int, int) to service_role;
