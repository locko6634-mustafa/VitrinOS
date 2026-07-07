drop policy if exists "Admins can manage all brands" on public.brands;
drop policy if exists "Users can read own brands" on public.brands;
drop policy if exists "Admins can manage all brand prompts" on public.brand_prompts;
drop policy if exists "Admins can manage all jobs" on public.jobs;
drop policy if exists "Users can read own jobs" on public.jobs;
drop policy if exists "Users can create own jobs" on public.jobs;
drop policy if exists "Users can update own jobs" on public.jobs;
drop policy if exists "Anyone can submit leads" on public.leads;
drop policy if exists "Admins can manage all leads" on public.leads;
drop policy if exists "Authenticated users can read generated assets metadata" on storage.objects;

create policy "Brands are readable by owner or admin"
on public.brands
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins can insert brands"
on public.brands
for insert
to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update brands"
on public.brands
for update
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete brands"
on public.brands
for delete
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can read brand prompts"
on public.brand_prompts
for select
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can insert brand prompts"
on public.brand_prompts
for insert
to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update brand prompts"
on public.brand_prompts
for update
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete brand prompts"
on public.brand_prompts
for delete
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Jobs are readable by owner or admin"
on public.jobs
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Jobs are insertable by owner or admin"
on public.jobs
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Jobs are updatable by owner or admin"
on public.jobs
for update
to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins can delete jobs"
on public.jobs
for delete
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Leads are insertable as new"
on public.leads
for insert
to anon, authenticated
with check (
  status = 'new'
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Admins can read leads"
on public.leads
for select
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update leads"
on public.leads
for update
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete leads"
on public.leads
for delete
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
