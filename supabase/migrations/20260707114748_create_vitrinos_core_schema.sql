create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  logo_url text,
  website_url text,
  color_palette jsonb not null default '{"primary":"#d9962a","secondary":"#7a4f12","theme":"koyu"}'::jsonb,
  tone_rules text,
  banned_words text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_prompts (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  base_prompt text,
  banner_prompt text,
  meta_post_prompt text,
  story_prompt text,
  revize_prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  brief_text text not null,
  format text not null check (format in ('Banner', 'Meta Post', 'Story')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'approved', 'revision_requested')),
  image_url text,
  revision_count int not null default 0 check (revision_count >= 0),
  revision_note text,
  brief_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null,
  website text,
  need text,
  note text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brands_user_id_idx on public.brands(user_id);
create index jobs_user_id_idx on public.jobs(user_id);
create index jobs_brand_id_idx on public.jobs(brand_id);
create index jobs_status_idx on public.jobs(status);
create index leads_status_idx on public.leads(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_brands_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create trigger set_brand_prompts_updated_at
before update on public.brand_prompts
for each row execute function public.set_updated_at();

create trigger set_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.brand_prompts enable row level security;
alter table public.jobs enable row level security;
alter table public.leads enable row level security;

create policy "Admins can manage all brands"
on public.brands
for all
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can read own brands"
on public.brands
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins can manage all brand prompts"
on public.brand_prompts
for all
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage all jobs"
on public.jobs
for all
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users can read own jobs"
on public.jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own jobs"
on public.jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own jobs"
on public.jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Anyone can submit leads"
on public.leads
for insert
to anon, authenticated
with check (status = 'new');

create policy "Admins can manage all leads"
on public.leads
for all
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-assets',
  'generated-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
