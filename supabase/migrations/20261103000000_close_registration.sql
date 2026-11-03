-- LEBLOND: close sign-up again. Only an email on the active whitelist may create
-- an account, and only active whitelist members pass is_active_beta_user(), so
-- every RLS policy that calls it enforces the closed beta. Nothing is deleted:
-- accounts outside the whitelist keep their rows but can no longer use them.

-- Never lock everyone out: when accounts exist, an active admin must already be
-- on the whitelist. Otherwise stop here and change nothing.
do $$
begin
  if exists (select 1 from auth.users)
     and not exists (select 1 from public.beta_users b where b.active and b.role = 'admin') then
    raise exception 'Closing sign-up needs an active admin in public.beta_users. Load the whitelist first.';
  end if;
end $$;

-- enforce_beta_whitelist() was kept when sign-up opened; only its trigger went.
drop trigger if exists enforce_beta_whitelist on auth.users;
create trigger enforce_beta_whitelist before insert on auth.users
  for each row execute function public.enforce_beta_whitelist();

-- SECURITY DEFINER so policies can consult the whitelist without exposing it.
create or replace function public.is_active_beta_user() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.beta_users b
    where b.email = public.current_email() and b.active
  )
$$;
revoke all on function public.is_active_beta_user() from public, anon;
grant execute on function public.is_active_beta_user() to authenticated;
