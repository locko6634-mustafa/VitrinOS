-- 20260710004500_add_optimize_jobs_indexes.sql
-- jobs tablosundaki dashboard ve admin listeleme sorgularını optimize eden yeni kombine indeksler

CREATE INDEX IF NOT EXISTS jobs_user_id_created_at_idx ON public.jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_user_id_status_created_at_idx ON public.jobs (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_created_at_idx ON public.jobs (status, created_at DESC);
