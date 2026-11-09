-- Read-only closed-beta check for the hosted project, run by the Deploy database
-- workflow (mode: access). Counts and yes/no only: the repository and its logs
-- are public, so no email or name may ever appear in the output.
with accounts as (select lower(u.email) as email from auth.users u),
     invited as (select b.email, b.role from public.beta_users b where b.active)
select
  (select count(*) from accounts) as accounts,
  (select count(*) from invited) as active_invitations,
  (select count(*) from public.beta_users b where not b.active) as deactivated_invitations,
  (select count(*) from invited i where i.role = 'admin') as active_admins,
  (select count(*) from invited i where i.role = 'admin'
     and exists (select 1 from accounts a where a.email = i.email)) as active_admins_with_account,
  (select count(*) from invited i
     where not exists (select 1 from accounts a where a.email = i.email)) as invitations_without_account,
  (select count(*) from accounts a
     where a.email is null or not exists (select 1 from invited i where i.email = a.email)) as accounts_outside_whitelist,
  exists (select 1 from pg_trigger t where t.tgname = 'enforce_beta_whitelist'
     and t.tgrelid = 'auth.users'::regclass) as sign_up_closed,
  (select p.prosrc like '%beta_users%' from pg_proc p
     where p.oid = 'public.is_active_beta_user()'::regprocedure) as rls_checks_whitelist;
