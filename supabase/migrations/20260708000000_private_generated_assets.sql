update storage.buckets
set public = false
where id = 'generated-assets';

update public.jobs
set image_url = split_part(image_url, '/storage/v1/object/public/generated-assets/', 2)
where image_url like '%/storage/v1/object/public/generated-assets/%';

drop policy if exists "Authenticated users can upload generated assets" on storage.objects;
drop policy if exists "Authenticated users can update generated assets" on storage.objects;
drop policy if exists "Authenticated users can read generated assets metadata" on storage.objects;
drop policy if exists "Users can read own generated asset metadata" on storage.objects;

create policy "Users can read own generated asset metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generated-assets'
  and exists (
    select 1
    from public.jobs
    where jobs.brand_id::text = split_part(storage.objects.name, '/', 1)
      and jobs.id::text = split_part(split_part(storage.objects.name, '/', 2), '_', 1)
      and (
        jobs.user_id = (select auth.uid())
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);
