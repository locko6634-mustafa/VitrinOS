create table public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  action text not null check (char_length(action) between 1 and 80),
  outcome text not null check (outcome in ('requested', 'succeeded', 'failed')),
  target_user_id uuid,
  target_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index security_audit_log_occurred_at_idx
  on public.security_audit_log (occurred_at desc);

create index security_audit_log_target_user_id_idx
  on public.security_audit_log (target_user_id, occurred_at desc);

alter table public.security_audit_log enable row level security;

revoke all on table public.security_audit_log from anon, authenticated;
grant select on table public.security_audit_log to authenticated;
grant all on table public.security_audit_log to service_role;

create policy "Admins can read security audit log"
on public.security_audit_log
for select
to authenticated
using ((select private.is_admin()));
