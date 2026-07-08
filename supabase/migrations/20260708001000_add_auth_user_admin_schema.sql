create extension if not exists pgcrypto with schema extensions;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

revoke all on table public.users from anon;
revoke all on table public.users from authenticated;
grant select on table public.users to authenticated;
grant all on table public.users to service_role;

drop policy if exists "Admins can manage users" on public.users;
drop policy if exists "Users are readable by self or admin" on public.users;

create policy "Users are readable by self or admin"
on public.users
for select
to authenticated
using (
  (select auth.uid()) = id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.users (
      id,
      email,
      banned_until,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      new.id,
      new.email,
      new.banned_until,
      new.last_sign_in_at,
      coalesce(new.created_at, now()),
      coalesce(new.updated_at, now())
    )
    on conflict (id) do update set
      email = excluded.email,
      banned_until = excluded.banned_until,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = now();
  elsif (tg_op = 'UPDATE') then
    update public.users
    set
      email = new.email,
      banned_until = new.banned_until,
      last_sign_in_at = new.last_sign_in_at,
      updated_at = now()
    where id = new.id;
  elsif (tg_op = 'DELETE') then
    delete from public.users where id = old.id;
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_auth_user_change() from public, anon, authenticated;
grant execute on function public.handle_auth_user_change() to service_role;

insert into public.users (
  id,
  email,
  banned_until,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  email,
  banned_until,
  last_sign_in_at,
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from auth.users
where email is not null
on conflict (id) do update set
  email = excluded.email,
  banned_until = excluded.banned_until,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

drop trigger if exists on_auth_user_change on auth.users;

create trigger on_auth_user_change
after insert or update or delete on auth.users
for each row execute function public.handle_auth_user_change();

create or replace function public.invite_user(user_email text, user_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_user_id uuid;
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
    extensions.crypt('Vitrinos123!', extensions.gen_salt('bf')),
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

  return jsonb_build_object('success', true, 'user_id', new_user_id);
end;
$$;

revoke execute on function public.invite_user(text, text) from public, anon;
grant execute on function public.invite_user(text, text) to authenticated;
grant execute on function public.invite_user(text, text) to service_role;

create or replace function public.toggle_user_status(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_banned timestamptz;
  new_status text;
begin
  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') != 'admin' then
    raise exception 'Yetkisiz islem.';
  end if;

  if target_user_id is null then
    raise exception 'Kullanici id zorunlu.';
  end if;

  select banned_until
  into current_banned
  from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'Kullanici bulunamadi.';
  end if;

  if current_banned is null then
    update auth.users
    set
      banned_until = '2099-12-31 23:59:59+00',
      updated_at = now()
    where id = target_user_id;
    new_status := 'inactive';
  else
    update auth.users
    set
      banned_until = null,
      updated_at = now()
    where id = target_user_id;
    new_status := 'active';
  end if;

  return jsonb_build_object('success', true, 'status', new_status);
end;
$$;

revoke execute on function public.toggle_user_status(uuid) from public, anon;
grant execute on function public.toggle_user_status(uuid) to authenticated;
grant execute on function public.toggle_user_status(uuid) to service_role;
