-- Auth administration is exposed only through the protected Edge Function.
revoke execute on function public.invite_user(text, text) from public, anon, authenticated;
revoke execute on function public.toggle_user_status(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;

grant execute on function public.invite_user(text, text) to service_role;
grant execute on function public.toggle_user_status(uuid) to service_role;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
