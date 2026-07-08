drop policy if exists "Leads are insertable as new" on public.leads;

create policy "Admins can insert leads"
on public.leads
for insert
to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.lead_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  email_hash text not null,
  fingerprint_hash text not null,
  website_host text,
  user_agent text,
  outcome text not null check (
    outcome in (
      'blocked_honeypot',
      'blocked_validation',
      'blocked_rate_limit',
      'blocked_duplicate',
      'accepted'
    )
  ),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_submission_attempts_created_at_idx
on public.lead_submission_attempts(created_at desc);

create index if not exists lead_submission_attempts_ip_hash_created_at_idx
on public.lead_submission_attempts(ip_hash, created_at desc);

create index if not exists lead_submission_attempts_email_hash_created_at_idx
on public.lead_submission_attempts(email_hash, created_at desc);

create index if not exists lead_submission_attempts_fingerprint_hash_created_at_idx
on public.lead_submission_attempts(fingerprint_hash, created_at desc);

alter table public.lead_submission_attempts enable row level security;

create policy "Admins can read lead submission attempts"
on public.lead_submission_attempts
for select
to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
