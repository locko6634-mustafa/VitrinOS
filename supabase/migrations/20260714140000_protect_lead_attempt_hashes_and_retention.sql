-- Lead denemeleri kişisel veri niteliğindeki sinyaller içerir.
-- HMAC anahtarı Edge Function secret olarak tutulur; veritabanına yazılmaz.

create or replace function public.cleanup_lead_submission_attempts(
  p_retention interval default interval '30 days'
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  if p_retention <= interval '0 seconds' then
    raise exception 'Retention interval must be positive';
  end if;

  delete from public.lead_submission_attempts
  where created_at < now() - p_retention;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_lead_submission_attempts(interval)
from public, anon, authenticated;
grant execute on function public.cleanup_lead_submission_attempts(interval)
to service_role;

-- Salt'sız SHA-256 ile üretilmiş eski değerler yeniden üretilemez ve güvenle
-- HMAC'e dönüştürülemez; yeni format devreye alınırken geçmiş denemeleri sil.
delete from public.lead_submission_attempts;

-- pg_cron is enabled on the project by this migration and runs cleanup daily.
create extension if not exists pg_cron;

select cron.schedule(
  'lead-submission-attempts-retention',
  '0 3 * * *',
  $$select public.cleanup_lead_submission_attempts(interval '30 days');$$
)
where not exists (
  select 1 from cron.job
  where jobname = 'lead-submission-attempts-retention'
);
