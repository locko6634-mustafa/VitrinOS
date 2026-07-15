-- migration: prevent_user_deletion_race_condition

-- 1. storage_cleanup_queue tablosundaki status constraint'ini drop edip awaiting_parent_delete durumunu da içerecek şekilde yeniden oluşturuyoruz
alter table private.storage_cleanup_queue drop constraint if exists storage_cleanup_queue_status_check;
alter table private.storage_cleanup_queue add constraint storage_cleanup_queue_status_check
  check (status in ('awaiting_parent_delete', 'pending', 'processing', 'succeeded', 'dead'));

-- 2. enqueue_user_storage_cleanup fonksiyonunu güncelleyip kuyruğa eklenen kayıtların status değerini awaiting_parent_delete yapıyoruz
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

  insert into private.storage_cleanup_queue (bucket_id, object_path, reason, status)
  select distinct o.bucket_id, o.name, 'user_deletion', 'awaiting_parent_delete'
  from storage.objects o
  join public.jobs j
    on j.brand_id::text = split_part(o.name, '/', 1)
   and j.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
  where o.bucket_id = 'generated-assets'
    and j.user_id = target_user_id
  on conflict (bucket_id, object_path) do update
    set status = 'awaiting_parent_delete',
        next_attempt_at = now(),
        updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

-- 3. release_user_storage_cleanup fonksiyonunu ekliyoruz. (awaiting_parent_delete durumundaki kayıtları pending yapıyor)
create or replace function public.release_user_storage_cleanup(target_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'private', 'storage'
as $function$
declare updated_count bigint;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may release storage cleanup';
  end if;

  update private.storage_cleanup_queue q
  set status = 'pending',
      next_attempt_at = now(),
      updated_at = now()
  from storage.objects o
  join public.jobs j
    on j.brand_id::text = split_part(o.name, '/', 1)
   and j.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
  where q.bucket_id = o.bucket_id
    and q.object_path = o.name
    and o.bucket_id = 'generated-assets'
    and j.user_id = target_user_id
    and q.status = 'awaiting_parent_delete';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$function$;

-- 4. cancel_user_storage_cleanup fonksiyonunu ekliyoruz. (silme iptal olursa awaiting_parent_delete durumundaki kayıtları siliyor)
create or replace function public.cancel_user_storage_cleanup(target_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'private', 'storage'
as $function$
declare deleted_count bigint;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only service_role may cancel storage cleanup';
  end if;

  delete from private.storage_cleanup_queue q
  using storage.objects o, public.jobs j
  where q.bucket_id = o.bucket_id
    and q.object_path = o.name
    and j.brand_id::text = split_part(o.name, '/', 1)
    and j.id::text = split_part(split_part(o.name, '/', 2), '_', 1)
    and o.bucket_id = 'generated-assets'
    and j.user_id = target_user_id
    and q.status = 'awaiting_parent_delete';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

-- 5. Fonksiyon yetkilendirmelerini yapıyoruz
revoke execute on function public.release_user_storage_cleanup(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_user_storage_cleanup(uuid) from public, anon, authenticated;

grant execute on function public.enqueue_user_storage_cleanup(uuid) to service_role;
grant execute on function public.release_user_storage_cleanup(uuid) to service_role;
grant execute on function public.cancel_user_storage_cleanup(uuid) to service_role;
