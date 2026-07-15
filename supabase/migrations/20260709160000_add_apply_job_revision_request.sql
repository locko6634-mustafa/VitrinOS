-- apply_job_revision_request fonksiyonu
CREATE OR REPLACE FUNCTION public.apply_job_revision_request(target_job_id uuid, target_user_id uuid, revision_note text)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  clean_note text := nullif(trim(revision_note), '');
  updated_job public.jobs;
begin
  if target_user_id is null then
    raise exception 'Oturum zorunlu.';
  end if;

  if clean_note is null or length(clean_note) < 6 then
    raise exception 'Revizyon notu en az 6 karakter olmali.';
  end if;

  update public.jobs
  set
    status = 'revision_requested',
    revision_count = revision_count + 1,
    revision_note = clean_note
  where id = target_job_id
    and user_id = target_user_id
    and status = 'completed'
    and revision_count < 3
  returning * into updated_job;

  if not found then
    raise exception 'Job bulunamadi, revizyon istenebilir durumda degil veya revizyon limitine ulasildi.';
  end if;

  return updated_job;
end;
$function$;

-- İzinler
-- GÜVENLİK TASARIMI: Bu fonksiyon, durum geçişlerini ve revizyon limitlerini kontrol ettiği için 
-- doğrudan authenticated kullanıcılar tarafından çağrılamaz. Çağrı yetkisi sadece service_role'a verilmiştir 
-- ve işlemler job-actions Edge Function'ı aracılığıyla doğrulanarak yürütülür.
REVOKE EXECUTE ON FUNCTION public.apply_job_revision_request(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_job_revision_request(uuid, uuid, text) TO service_role;
