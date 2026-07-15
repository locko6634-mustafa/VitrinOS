alter table public.jobs
  add column if not exists source_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-assets',
  'source-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own source assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'source-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
);

create policy "Users can delete own source assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'source-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter policy "Jobs are insertable by owner or admin"
on public.jobs
with check (
  (select private.is_active_user())
  and (
    (
      (select auth.uid()) = user_id
      and exists (
        select 1 from public.brands b
        where b.id = jobs.brand_id and b.user_id = (select auth.uid())
      )
      and status = 'pending'
      and image_url is null
      and revision_count = 0
      and revision_note is null
      and brief_json is null
      and (
        source_image_path is null
        or source_image_path ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      )
    )
    or (select private.is_admin())
  )
);
