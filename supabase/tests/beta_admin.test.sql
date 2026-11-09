-- The admin deactivates / reactivates testers through their own session (self-contained).
\set ON_ERROR_STOP 1
create or replace function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  begin execute stmt; exception when others then
    raise notice 'ok (expected failure) %: [%] %', label, sqlstate, sqlerrm; return; end;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
end $$;
create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

insert into public.beta_users (email, display_name, role) values
  ('ba-admin@admin-rpc.test', 'BA Admin', 'admin'),
  ('ba-admin2@admin-rpc.test', 'BA Admin 2', 'admin'),
  ('ba-tester@admin-rpc.test', 'BA Tester', 'beta_tester'),
  ('ba-other@admin-rpc.test', 'BA Other', 'beta_tester')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('f5000000-0000-0000-0000-00000000000a', 'ba-admin@admin-rpc.test'),
  ('f5000000-0000-0000-0000-00000000000b', 'ba-tester@admin-rpc.test');

-- The admin deactivates, then reactivates, a tester (email typed loosely).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000a","email":"ba-admin@admin-rpc.test","role":"authenticated"}', false);
select pg_temp.expect(public.admin_set_beta_user_active(' BA-Tester@admin-rpc.test ', false), 'the admin deactivates a tester');
select pg_temp.expect((select not active from public.beta_users where email = 'ba-tester@admin-rpc.test'), 'the tester is deactivated');
select pg_temp.expect(public.admin_set_beta_user_active('ba-tester@admin-rpc.test', true), 'the admin reactivates a tester');
select pg_temp.expect((select active from public.beta_users where email = 'ba-tester@admin-rpc.test'), 'the tester is active again');

-- Never the admin's own row, another admin, an unknown email or a missing value.
select pg_temp.expect(not public.admin_set_beta_user_active('ba-admin@admin-rpc.test', false), 'the admin cannot deactivate themself');
select pg_temp.expect(not public.admin_set_beta_user_active('ba-admin2@admin-rpc.test', false), 'the admin cannot deactivate another admin');
select pg_temp.expect(not public.admin_set_beta_user_active('nobody@admin-rpc.test', false), 'an unknown email changes nothing');
select pg_temp.expect(not public.admin_set_beta_user_active('ba-other@admin-rpc.test', null), 'a missing value changes nothing');
reset role;
select pg_temp.expect((select bool_and(active) from public.beta_users where email like '%@admin-rpc.test'),
  'refusals left everyone active');

-- A tester or an anonymous visitor cannot use it.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000b","email":"ba-tester@admin-rpc.test","role":"authenticated"}', false);
select pg_temp.expect_error($$select public.admin_set_beta_user_active('ba-other@admin-rpc.test', false)$$, 'a tester cannot deactivate anyone');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select public.admin_set_beta_user_active('ba-other@admin-rpc.test', false)$$, 'an anonymous visitor cannot deactivate anyone');
reset role;
select pg_temp.expect((select active from public.beta_users where email = 'ba-other@admin-rpc.test'), 'the other tester is still active');
