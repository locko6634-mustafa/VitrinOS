-- Admin data and admin-only RPC authorization require a verified MFA session.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (
    (select auth.jwt() ->> 'role') = 'service_role'
    or (
      (select auth.jwt() ->> 'aal') = 'aal2'
      and exists (
        select 1
        from public.users u
        where u.id = (select auth.uid())
          and u.is_admin = true
          and (u.banned_until is null or u.banned_until <= now())
      )
    )
  );
$$;
