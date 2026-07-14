-- VitrinOS SECURITY DEFINER RPC Güvenlik Güncellemesi
-- 1. Sabit şifre kaldırılarak rastgele geçici şifre üretimine geçiliyor.
-- 2. SECURITY DEFINER fonksiyonlar için veritabanı seviyesinde istisna (exception) açıklamaları ekleniyor.

create or replace function public.invite_user(user_email text, user_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_user_id uuid;
  temp_password text;
begin
  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') != 'admin' then
    raise exception 'Yetkisiz islem. Sadece adminler davet gonderebilir.';
  end if;

  if nullif(trim(user_email), '') is null then
    raise exception 'E-posta adresi zorunlu.';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(user_email))
  ) then
    raise exception 'Bu e-posta adresiyle kayitli bir kullanici zaten mevcut.';
  end if;

  -- 12 karakterli rastgele geçici şifre oluştur (UUID'den türetilmiş)
  temp_password := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous,
    confirmation_token,
    email_change_token_new,
    recovery_token,
    email_change_token_current,
    phone_change_token,
    email_change,
    phone_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    lower(trim(user_email)),
    extensions.crypt(temp_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', nullif(trim(user_name), '')),
    now(),
    now(),
    false,
    false,
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  )
  returning id into new_user_id;

  return jsonb_build_object('success', true, 'user_id', new_user_id, 'temporary_password', temp_password);
end;
$$;

-- İzinleri yeniden yapılandır
revoke execute on function public.invite_user(text, text) from public, anon;
grant execute on function public.invite_user(text, text) to authenticated;
grant execute on function public.invite_user(text, text) to service_role;

-- SECURITY DEFINER Linter İstisnalarını Veritabanı Seviyesinde Yorum Olarak Dokümante Et
comment on function public.invite_user(text, text) is 'SECURITY DEFINER: authenticated role execute yetkisi verilmistir, yetki kontrolü admin rolu ile iceride yapilmaktadir. (Bilincli Istisna)';
comment on function public.toggle_user_status(uuid) is 'SECURITY DEFINER: authenticated role execute yetkisi verilmistir, yetki kontrolü admin rolu ile iceride yapilmaktadir. (Bilincli Istisna)';
comment on function public.approve_job(uuid) is 'SECURITY DEFINER: authenticated role execute yetkisi verilmistir, is sahibi (user_id = auth.uid()) kontrolü iceride yapilmaktadir. (Bilincli Istisna)';
comment on function public.request_job_revision(uuid, text) is 'SECURITY DEFINER: authenticated role execute yetkisi verilmistir, is sahibi (user_id = auth.uid()) kontrolü iceride yapilmaktadir. (Bilincli Istisna)';
comment on function public.handle_auth_user_change() is 'SECURITY DEFINER: Sadece service_role tarafından tetiklenen auth eventleri icin kullanilir. (Bilincli Istisna)';
