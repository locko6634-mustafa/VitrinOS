-- Job metriklerinin tahmine değil, workflow tarafından kaydedilen olay zamanlarına
-- ve açık kalite skoruna dayanmasını sağlar.

alter table public.jobs
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists brand_match_score numeric(5,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_brand_match_score_range'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_brand_match_score_range
      check (brand_match_score is null or (brand_match_score >= 0 and brand_match_score <= 100));
  end if;
end
$$;

comment on column public.jobs.processing_started_at is 'Job ilk kez processing durumuna geçtiği an.';
comment on column public.jobs.completed_at is 'Job completed durumuna geçtiği an.';
comment on column public.jobs.brand_match_score is 'Harici kalite değerlendirmesinden gelen 0-100 marka uyumu skoru; başarı oranı değildir.';

create or replace function public.set_job_metric_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'processing' and (old.status is distinct from 'processing') then
    new.processing_started_at := coalesce(new.processing_started_at, now());
  end if;

  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_set_metric_timestamps on public.jobs;
create trigger jobs_set_metric_timestamps
before update on public.jobs
for each row execute function public.set_job_metric_timestamps();
