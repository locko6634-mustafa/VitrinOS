-- LOG-H3 — Dispatch hataları için veritabanı şeması güncellemesi.

-- 1. jobs_status_check kısıtlamasını güncelleyelim.
-- Önce eski kısıtlamayı kaldırıyoruz.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Yeni durumları (failed_dispatch ve pending_retry) içerecek şekilde kısıtlamayı tekrar ekliyoruz.
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status = ANY (ARRAY[
    'pending'::text,
    'processing'::text,
    'completed'::text,
    'failed'::text,
    'approved'::text,
    'revision_requested'::text,
    'failed_dispatch'::text,
    'pending_retry'::text
  ])
);

-- 2. Hata takibi ve otomatik yeniden deneme politikası için kolonları ekliyoruz.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3 CHECK (max_retries BETWEEN 1 AND 10);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone;
