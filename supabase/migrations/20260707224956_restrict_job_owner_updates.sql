drop policy if exists "Jobs are updatable by owner or admin" on public.jobs;

revoke update on table public.jobs from anon;
revoke update on table public.jobs from authenticated;
grant update on table public.jobs to service_role;

create policy "Service role can update jobs"
on public.jobs
for update
to service_role
using (true)
with check (true);

create or replace function public.approve_job(target_job_id uuid)
returns public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_job public.jobs;
begin
  if (select auth.uid()) is null then
    raise exception 'Oturum zorunlu.';
  end if;

  update public.jobs
  set status = 'approved'
  where id = target_job_id
    and user_id = (select auth.uid())
    and status = 'completed'
  returning * into updated_job;

  if not found then
    raise exception 'Job bulunamadi veya onaylanabilir durumda degil.';
  end if;

  return updated_job;
end;
$$;

create or replace function public.request_job_revision(target_job_id uuid, revision_note text)
returns public.jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_note text := nullif(trim(revision_note), '');
  updated_job public.jobs;
begin
  if (select auth.uid()) is null then
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
    and user_id = (select auth.uid())
    and status = 'completed'
  returning * into updated_job;

  if not found then
    raise exception 'Job bulunamadi veya revizyon istenebilir durumda degil.';
  end if;

  return updated_job;
end;
$$;

revoke execute on function public.approve_job(uuid) from public, anon;
revoke execute on function public.request_job_revision(uuid, text) from public, anon;
grant execute on function public.approve_job(uuid) to authenticated;
grant execute on function public.request_job_revision(uuid, text) to authenticated;
grant execute on function public.approve_job(uuid) to service_role;
grant execute on function public.request_job_revision(uuid, text) to service_role;
