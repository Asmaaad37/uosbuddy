-- H4: any verified student could upload to the post, listing, course and chat buckets without
-- limit, and nothing had to use the file. Uploads now stop at 60 files a day per student
-- (each file is already size-capped by its bucket).
-- H3: files outlived what they belonged to: deleted or removed posts, listings, resources and
-- messages, unused uploads, and purged accounts. unused_storage_files() lists them for the
-- daily job, which deletes them through the Storage API.

create or replace function public.under_upload_quota() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) < 60 from storage.objects
  where owner_id = auth.uid()::text
    and bucket_id in ('post-media', 'listing-media', 'course-resources', 'chat-attachments')
    and created_at > now() - interval '1 day';
$$;
revoke execute on function public.under_upload_quota() from public, anon;
grant execute on function public.under_upload_quota() to authenticated;

drop policy post_media_insert on storage.objects;
create policy post_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (select public.is_verified())
              and name ~ '^posts/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
              and (select public.under_upload_quota()));

drop policy listing_media_insert on storage.objects;
create policy listing_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-media' and (select public.is_verified())
              and name ~ '^listings/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
              and (select public.under_upload_quota()));

drop policy course_resources_insert on storage.objects;
create policy course_resources_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'course-resources' and (select public.is_verified())
              and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)\Z'
              and (select public.under_upload_quota()));

drop policy chat_attachments_insert on storage.objects;
create policy chat_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and public.can_use_conversation_path(name)
              and (select public.under_upload_quota()));

-- Files nothing live points to, oldest first. The age gap keeps uploads that are about to be
-- attached, and gives a moderator a day to restore removed content with its photos.
create function public.unused_storage_files(
  p_older_than interval default '1 day',
  p_limit int default 500
) returns table (bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.created_at < now() - p_older_than
    and case o.bucket_id
      when 'post-media' then not exists (
        select 1 from public.posts p
        where p.status in ('published', 'held') and o.name = any (p.media_paths))
      when 'listing-media' then not exists (
        select 1 from public.listings l
        where l.status in ('active', 'done', 'held') and o.name = any (l.media_paths))
      when 'course-resources' then not exists (
        select 1 from public.resources r where r.status <> 'removed' and r.file_path = o.name)
      when 'chat-attachments' then not exists (
        select 1 from public.messages m where m.attachment_path = o.name)
      -- A student's avatars stay while they exist; replaced versions are removed on save.
      when 'avatars' then not exists (
        select 1 from public.profiles pr where pr.id::text = split_part(o.name, '/', 1))
      when 'data-exports' then not exists (
        select 1 from public.data_exports e where e.path = o.name)
      else false
    end
  order by o.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;
revoke execute on function public.unused_storage_files(interval, int) from public, anon, authenticated;
grant execute on function public.unused_storage_files(interval, int) to service_role;
