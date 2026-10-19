-- LEBLOND: open accounts, preserving per-user RLS and the legacy admin roster.
drop trigger if exists enforce_beta_whitelist on auth.users;

-- A historical RLS helper gates all signed-in members, rather than invitations.
create or replace function public.is_active_beta_user() returns boolean
language sql stable security invoker set search_path = ''
as $$
  select auth.uid() is not null
$$;
revoke all on function public.is_active_beta_user() from public, anon;
grant execute on function public.is_active_beta_user() to authenticated;

-- Profile creation works for password and OAuth users without service-role API.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email,''), '@', 1), ''),
      'Climber'
    ), 60
  );
  insert into public.profiles(id, display_name)
  values (new.id, v_name)
  on conflict(id) do nothing;
  return new;
end $$;

-- Keep administrative access restricted to the prior admin roster.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
