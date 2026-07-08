drop policy if exists "Authenticated users can upload generated assets" on storage.objects;
drop policy if exists "Authenticated users can update generated assets" on storage.objects;
drop policy if exists "Users can upload own generated assets" on storage.objects;
drop policy if exists "Users can update own generated assets" on storage.objects;

create policy "Users can upload own generated assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'generated-assets'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and split_part(name, '/', 3) = ''
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

create policy "Users can update own generated assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'generated-assets'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and split_part(name, '/', 3) = ''
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
)
with check (
  bucket_id = 'generated-assets'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and split_part(name, '/', 3) = ''
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
