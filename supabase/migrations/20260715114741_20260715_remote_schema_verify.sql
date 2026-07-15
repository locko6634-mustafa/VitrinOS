set check_function_bodies = off;

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
