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
