-- JWT app_metadata claims can remain stale until refresh. Keep authorization
-- decisions that must be immediate in the database-backed users projection.

alter table public.users
  add column if not exists is_admin boolean not null default false;

update public.users u
set is_admin = coalesce((a.raw_app_meta_data ->> 'role') = 'admin', false)
from auth.users a
where a.id = u.id;

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.is_admin = true
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and (u.banned_until is null or u.banned_until <= now())
    );
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_active_user() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_active_user() to authenticated, service_role;

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.users (
      id, email, banned_until, last_sign_in_at, is_admin, created_at, updated_at
    )
    values (
      new.id, new.email, new.banned_until, new.last_sign_in_at,
      coalesce((new.raw_app_meta_data ->> 'role') = 'admin', false),
      coalesce(new.created_at, now()), coalesce(new.updated_at, now())
    )
    on conflict (id) do update set
      email = excluded.email,
      banned_until = excluded.banned_until,
      last_sign_in_at = excluded.last_sign_in_at,
      is_admin = excluded.is_admin,
      updated_at = now();
  elsif (tg_op = 'UPDATE') then
    update public.users
    set email = new.email,
        banned_until = new.banned_until,
        last_sign_in_at = new.last_sign_in_at,
        is_admin = coalesce((new.raw_app_meta_data ->> 'role') = 'admin', false),
        updated_at = now()
    where id = new.id;
  elsif (tg_op = 'DELETE') then
    delete from public.users where id = old.id;
    return old;
  end if;

  return new;
end;
$$;

-- Existing admin-only policies now use the live database projection.
alter policy "Admins can delete brand prompts" on public.brand_prompts using ((select private.is_admin()));
alter policy "Admins can insert brand prompts" on public.brand_prompts with check ((select private.is_admin()));
alter policy "Admins can read brand prompts" on public.brand_prompts using ((select private.is_admin()));
alter policy "Admins can update brand prompts" on public.brand_prompts using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "Admins can delete brands" on public.brands using ((select private.is_admin()));
alter policy "Admins can insert brands" on public.brands with check ((select private.is_admin()));
alter policy "Admins can update brands" on public.brands using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "Admins can delete jobs" on public.jobs using ((select private.is_admin()));
alter policy "Admins can read lead submission attempts" on public.lead_submission_attempts using ((select private.is_admin()));
alter policy "Admins can delete leads" on public.leads using ((select private.is_admin()));
alter policy "Admins can insert leads" on public.leads with check ((select private.is_admin()));
alter policy "Admins can read leads" on public.leads using ((select private.is_admin()));
alter policy "Admins can update leads" on public.leads using ((select private.is_admin())) with check ((select private.is_admin()));

alter policy "Brands are readable by owner or admin" on public.brands
  using ((select private.is_active_user()) and ((select auth.uid()) = user_id or (select private.is_admin())));
alter policy "Jobs are readable by owner or admin" on public.jobs
  using ((select private.is_active_user()) and ((select auth.uid()) = user_id or (select private.is_admin())));
alter policy "Jobs are insertable by owner or admin" on public.jobs
  with check ((select private.is_active_user()) and (((select auth.uid()) = user_id and exists (select 1 from public.brands b where b.id = jobs.brand_id and b.user_id = (select auth.uid())) and status = 'pending' and image_url is null and revision_count = 0 and revision_note is null and brief_json is null) or (select private.is_admin())));
alter policy "Users are readable by self or admin" on public.users
  using ((select private.is_active_user()) and ((select auth.uid()) = id or (select private.is_admin())));

alter policy "Users can read own generated asset metadata" on storage.objects
  using (
    (select private.is_active_user())
    and bucket_id = 'generated-assets'
    and exists (
      select 1 from public.jobs j
      where j.brand_id::text = split_part(objects.name, '/', 1)
        and j.id::text = split_part(split_part(objects.name, '/', 2), '_', 1)
        and (j.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

create or replace function public.invite_user(user_email text, user_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare new_user_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Yetkisiz islem. Sadece adminler davet gonderebilir.';
  end if;
  if nullif(trim(user_email), '') is null then raise exception 'E-posta adresi zorunlu.'; end if;
  if exists (select 1 from auth.users where lower(email) = lower(trim(user_email))) then
    raise exception 'Bu e-posta adresiyle kayitli bir kullanici zaten mevcut.';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous, confirmation_token, email_change_token_new, recovery_token, email_change_token_current, phone_change_token, email_change)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', lower(trim(user_email)), extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', nullif(trim(user_name), '')), now(), now(), false, false, '', '', '', '', '', '')
  returning id into new_user_id;
  return jsonb_build_object('success', true, 'user_id', new_user_id);
end;
$$;

create or replace function public.toggle_user_status(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare current_banned timestamptz; new_status text;
begin
  if not (select private.is_admin()) then raise exception 'Yetkisiz islem.'; end if;
  select banned_until into current_banned from auth.users where id = target_user_id;
  if not found then raise exception 'Kullanici bulunamadi.'; end if;
  if current_banned is null then
    update auth.users set banned_until = '2099-12-31 23:59:59+00', updated_at = now() where id = target_user_id;
    delete from auth.sessions where user_id = target_user_id;
    new_status := 'inactive';
  else
    update auth.users set banned_until = null, updated_at = now() where id = target_user_id;
    new_status := 'active';
  end if;
  return jsonb_build_object('success', true, 'status', new_status);
end;
$$;

create or replace function public.revoke_user_sessions(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (select private.is_admin()) and (select auth.jwt() ->> 'role') <> 'service_role' then
    raise exception 'Yetkisiz islem.';
  end if;
  delete from auth.sessions where user_id = target_user_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon;
grant execute on function public.revoke_user_sessions(uuid) to authenticated, service_role;
