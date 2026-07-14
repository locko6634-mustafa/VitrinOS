create or replace function public.submit_lead_atomically(
  p_ip_hash text,
  p_email_hash text,
  p_fingerprint_hash text,
  p_website_host text,
  p_user_agent text,
  p_name text,
  p_company text,
  p_email text,
  p_website text,
  p_need text,
  p_note text,
  p_ip_limit integer,
  p_email_limit integer,
  p_ip_window interval,
  p_email_window interval,
  p_duplicate_window interval,
  p_cooldown interval
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  ip_count integer;
  email_count integer;
  duplicate_count integer;
  cooldown_count integer;
  result_status integer;
  result_message text;
  result_outcome text;
  result_reason text;
begin
  -- Acquire the same locks in the same order for every request to avoid races and deadlocks.
  perform pg_advisory_xact_lock(hashtextextended('lead-ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('lead-email:' || p_email_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('lead-fingerprint:' || p_fingerprint_hash, 0));

  select count(*)::integer into ip_count
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and created_at >= now() - p_ip_window;

  select count(*)::integer into email_count
  from public.lead_submission_attempts
  where email_hash = p_email_hash
    and outcome = 'accepted'
    and created_at >= now() - p_email_window;

  select count(*)::integer into duplicate_count
  from public.lead_submission_attempts
  where fingerprint_hash = p_fingerprint_hash
    and outcome = 'accepted'
    and created_at >= now() - p_duplicate_window;

  select count(*)::integer into cooldown_count
  from public.lead_submission_attempts
  where ip_hash = p_ip_hash
    and created_at >= now() - p_cooldown;

  if cooldown_count > 0 then
    result_status := 429;
    result_message := 'Cok hizli tekrar deneme algilandi. Bir dakika sonra tekrar deneyin.';
    result_outcome := 'blocked_rate_limit';
    result_reason := 'IP cooldown limitine takildi.';
  elsif ip_count >= p_ip_limit then
    result_status := 429;
    result_message := 'Bu IP icin saatlik basvuru limiti doldu.';
    result_outcome := 'blocked_rate_limit';
    result_reason := 'Saatlik IP limiti asildi.';
  elsif email_count >= p_email_limit then
    result_status := 429;
    result_message := 'Bu e-posta icin gunluk basvuru limiti doldu.';
    result_outcome := 'blocked_rate_limit';
    result_reason := 'Gunluk e-posta limiti asildi.';
  elsif duplicate_count > 0 then
    result_status := 409;
    result_message := 'Bu basvuru zaten alinmis gorunuyor.';
    result_outcome := 'blocked_duplicate';
    result_reason := 'Ayni icerikte tekrar basvuru algilandi.';
  else
    insert into public.leads (name, company, email, website, need, note, status)
    values (p_name, p_company, p_email, p_website, p_need, p_note, 'new');

    result_status := 200;
    result_message := 'Basvuru alindi.';
    result_outcome := 'accepted';
    result_reason := 'Lead kabul edildi.';
  end if;

  insert into public.lead_submission_attempts (
    ip_hash,
    email_hash,
    fingerprint_hash,
    website_host,
    user_agent,
    outcome,
    reason
  )
  values (
    p_ip_hash,
    p_email_hash,
    p_fingerprint_hash,
    p_website_host,
    p_user_agent,
    result_outcome,
    result_reason
  );

  return jsonb_build_object(
    'ok', result_status = 200,
    'status', result_status,
    'message', result_message
  );
end;
$$;

revoke all on function public.submit_lead_atomically(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, integer, interval, interval, interval, interval
) from public, anon, authenticated;

grant execute on function public.submit_lead_atomically(
  text, text, text, text, text, text, text, text, text, text, text,
  integer, integer, interval, interval, interval, interval
) to service_role;
