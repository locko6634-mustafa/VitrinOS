drop policy if exists "Jobs are insertable by owner or admin" on public.jobs;

create policy "Jobs are insertable by owner or admin"
on public.jobs
for insert
to authenticated
with check (
  (
    (select auth.uid()) = user_id
    and status = 'pending'
    and image_url is null
    and revision_count = 0
    and revision_note is null
    and brief_json is null
  )
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);
