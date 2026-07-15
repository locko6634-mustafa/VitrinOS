-- Canlı şemadan 2026-07-15 tarihinde doğrulanan, repository'de eksik kalan nesneler.
-- Bu migration canlıya geriye dönük uygulanmaz; yeni ortamların yeniden üretimi içindir.

create schema if not exists private;

create table if not exists private.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  reason text not null check (reason in ('user_deletion', 'orphan_reconciliation')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bucket_id, object_path)
);

create index if not exists storage_cleanup_queue_claim_idx
  on private.storage_cleanup_queue (status, next_attempt_at, created_at);

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
revoke all on table private.storage_cleanup_queue from public, anon, authenticated;
grant all on table private.storage_cleanup_queue to service_role;

alter table public.jobs add column if not exists processing_started_at timestamptz;
alter table public.jobs add column if not exists completed_at timestamptz;

create or replace function public.set_job_metric_timestamps()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'processing' and (old.status is distinct from 'processing') then
    new.processing_started_at := coalesce(new.processing_started_at, now());
  end if;

  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$function$;

drop trigger if exists jobs_set_metric_timestamps on public.jobs;
create trigger jobs_set_metric_timestamps
before update on public.jobs
for each row execute function public.set_job_metric_timestamps();

create or replace function public.enqueue_orphan_storage_cleanup()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'private', 'storage'
as $function$
declare inserted_count bigint;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may reconcile storage';
  end if;

  insert into private.storage_cleanup_queue (bucket_id, object_path, reason)
  select o.bucket_id, o.name, 'orphan_reconciliation'
  from storage.objects o
  where o.bucket_id = 'generated-assets'
    and split_part(o.name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.jobs j
      where j.brand_id::text = split_part(o.name, '/', 1)
        and j.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
    )
  on conflict (bucket_id, object_path) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

create or replace function public.enqueue_user_storage_cleanup(target_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'private', 'storage'
as $function$
declare inserted_count bigint;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may enqueue storage cleanup';
  end if;

  insert into private.storage_cleanup_queue (bucket_id, object_path, reason)
  select distinct o.bucket_id, o.name, 'user_deletion'
  from storage.objects o
  join public.jobs j
    on j.brand_id::text = split_part(o.name, '/', 1)
   and j.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
  where o.bucket_id = 'generated-assets'
    and j.user_id = target_user_id
  on conflict (bucket_id, object_path) do update
    set status = case when storage_cleanup_queue.status = 'succeeded' then 'pending' else storage_cleanup_queue.status end,
        next_attempt_at = case when storage_cleanup_queue.status = 'succeeded' then now() else storage_cleanup_queue.next_attempt_at end,
        updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

create or replace function public.claim_storage_cleanup_jobs(batch_size integer default 50)
returns table(id uuid, bucket_id text, object_path text, attempts integer)
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may claim storage cleanup';
  end if;

  update private.storage_cleanup_queue
  set status = 'pending', locked_at = null, updated_at = now()
  where status = 'processing' and locked_at < now() - interval '15 minutes';

  return query
  with claimed as (
    select q.id
    from private.storage_cleanup_queue q
    where q.status = 'pending'
      and q.next_attempt_at <= now()
    order by q.created_at
    for update skip locked
    limit greatest(1, least(batch_size, 200))
  )
  update private.storage_cleanup_queue q
  set status = 'processing', attempts = q.attempts + 1, locked_at = now(), updated_at = now()
  from claimed
  where q.id = claimed.id
  returning q.id, q.bucket_id, q.object_path, q.attempts;
end;
$function$;

create or replace function public.complete_storage_cleanup_job(
  job_id uuid, succeeded boolean, error_message text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may complete storage cleanup';
  end if;

  update private.storage_cleanup_queue
  set status = case when succeeded then 'succeeded' when attempts >= max_attempts then 'dead' else 'pending' end,
      next_attempt_at = case when succeeded or attempts >= max_attempts then next_attempt_at
        else now() + least(interval '1 hour', interval '1 minute' * power(2, greatest(attempts - 1, 0))) end,
      locked_at = null,
      last_error = case when succeeded then null else left(coalesce(error_message, 'Unknown storage deletion error'), 1000) end,
      completed_at = case when succeeded or attempts >= max_attempts then now() else null end,
      updated_at = now()
  where id = job_id and status = 'processing';
end;
$function$;

revoke execute on function public.enqueue_orphan_storage_cleanup() from public, anon, authenticated;
revoke execute on function public.enqueue_user_storage_cleanup(uuid) from public, anon, authenticated;
revoke execute on function public.claim_storage_cleanup_jobs(integer) from public, anon, authenticated;
revoke execute on function public.complete_storage_cleanup_job(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.enqueue_orphan_storage_cleanup() to service_role;
grant execute on function public.enqueue_user_storage_cleanup(uuid) to service_role;
grant execute on function public.claim_storage_cleanup_jobs(integer) to service_role;
grant execute on function public.complete_storage_cleanup_job(uuid, boolean, text) to service_role;
