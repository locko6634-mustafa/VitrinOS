alter table "public"."jobs" drop constraint "jobs_revision_count_check";

alter table "public"."jobs" add column "brand_match_score" numeric(5,2);

alter table "public"."jobs" add constraint "jobs_brand_match_score_range"
check (
  brand_match_score is null
  or (brand_match_score >= 0 and brand_match_score <= 100)
) not valid;

alter table "public"."jobs" validate constraint "jobs_brand_match_score_range";

alter table "public"."jobs" add constraint "jobs_revision_count_check"
check (revision_count >= 0 and revision_count <= 3) not valid;

alter table "public"."jobs" validate constraint "jobs_revision_count_check";

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

grant delete on table "public"."brand_prompts" to "service_role";
grant insert on table "public"."brand_prompts" to "service_role";
grant select on table "public"."brand_prompts" to "service_role";
grant update on table "public"."brand_prompts" to "service_role";

grant delete on table "public"."brands" to "service_role";
grant insert on table "public"."brands" to "service_role";
grant select on table "public"."brands" to "service_role";
grant update on table "public"."brands" to "service_role";

grant delete on table "public"."jobs" to "service_role";
grant insert on table "public"."jobs" to "service_role";
grant select on table "public"."jobs" to "service_role";

grant delete on table "public"."lead_submission_attempts" to "service_role";
grant insert on table "public"."lead_submission_attempts" to "service_role";
grant select on table "public"."lead_submission_attempts" to "service_role";
grant update on table "public"."lead_submission_attempts" to "service_role";

grant delete on table "public"."leads" to "service_role";
grant insert on table "public"."leads" to "service_role";
grant select on table "public"."leads" to "service_role";
grant update on table "public"."leads" to "service_role";
