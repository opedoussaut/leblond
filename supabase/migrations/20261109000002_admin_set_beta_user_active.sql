-- LEBLOND: the admin deactivates / reactivates testers from Beta administration
-- through their own session, so this no longer needs the service-role key in
-- the app. Never the admin's own row, never another admin. Nothing is deleted:
-- a deactivated tester keeps their data and lands on "Accès désactivé".
create or replace function public.admin_set_beta_user_active(p_email text, p_active boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_active is null or v_email = '' or v_email = public.current_email() then
    return false;
  end if;
  update public.beta_users set active = p_active where email = v_email and role <> 'admin';
  return found;
end $$;
revoke all on function public.admin_set_beta_user_active(text, boolean) from public, anon;
grant execute on function public.admin_set_beta_user_active(text, boolean) to authenticated;
