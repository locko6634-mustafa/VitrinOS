-- H-04: Public Data API erişimini açık GRANT modeliyle sınırla.
-- RLS policy'leri bu migration tarafından değiştirilmez.

-- Gelecekte postgres veya supabase_admin ile oluşturulan public nesneleri,
-- anon/authenticated rolleri için otomatik olarak erişilebilir olmasın.
alter default privileges in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Mevcut public tablolar için geniş yetkileri kaldır.
revoke all privileges on table
  public.brands,
  public.brand_prompts,
  public.jobs,
  public.leads,
  public.users,
  public.lead_submission_attempts
from anon, authenticated;

-- Frontend'in kullandığı işlemler için minimum authenticated izinleri.
grant select, insert, update on table public.brands to authenticated;
grant select, insert, update on table public.brand_prompts to authenticated;
grant select, insert on table public.jobs to authenticated;
grant select, update on table public.leads to authenticated;
grant select on table public.users to authenticated;

-- Sadece trigger olarak kullanılan fonksiyon Data API'den çağrılamaz.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
