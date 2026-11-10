-- Shared coach sessions: written by an administrator's key, read by every active climber.
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
  ('share-admin@share.test', 'Admin', 'admin'), ('share-c@share.test', 'C', 'beta_tester'), ('share-d@share.test', 'D', 'beta_tester');
insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-00000000000a', 'share-admin@share.test'),
  ('fa000000-0000-0000-0000-00000000000c', 'share-c@share.test'),
  ('fa000000-0000-0000-0000-00000000000d', 'share-d@share.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000a","email":"share-admin@share.test","role":"authenticated"}', false);
select public.create_coach_key('Claude') as key_admin \gset
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000c","email":"share-c@share.test","role":"authenticated"}', false);
select public.create_coach_key('Claude') as key_c \gset
reset role;

set role anon;
select set_config('request.jwt.claims', '', false);
select public.coach_key_put_session(:'key_admin', 'library-1', 'Bibliothèque', '', 60, null, '{"exercises":[{"block":"MAIN","name":"X"}]}', true);
select public.coach_key_put_session(:'key_admin', 'admin-private', 'Privée', '', 60, null, '{"exercises":[{"block":"MAIN","name":"X"}]}');
select pg_temp.expect_error(format($$select public.coach_key_put_session(%L, 'c-share', 'X', '', 60, null, '{"exercises":[{}]}', true)$$, :'key_c'),
  'a non-admin key cannot share');
select public.coach_key_put_session(:'key_c', 'c-private', 'Perso C', '', 60, null, '{"exercises":[{"block":"MAIN","name":"X"}]}');
select pg_temp.expect((select bool_or(shared) and count(*) = 2 from public.coach_key_list_sessions(:'key_admin')), 'list shows the shared flag');
reset role;

-- D (no key at all) sees the shared session only; C sees it plus their own.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000d","email":"share-d@share.test","role":"authenticated"}', false);
select pg_temp.expect((select array_agg(slug order by slug) = array['library-1'] from public.coach_sessions where user_id <> auth.uid() and slug in ('library-1','admin-private','c-private')),
  'D sees the shared session only');
delete from public.coach_sessions where slug = 'library-1';
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000c","email":"share-c@share.test","role":"authenticated"}', false);
select pg_temp.expect((select array_agg(slug order by slug) = array['c-private','library-1'] from public.coach_sessions where slug in ('library-1','admin-private','c-private')),
  'C sees the shared session and their own, D could not delete it');
reset role;

-- Unsharing hides it again.
set role anon;
select public.coach_key_put_session(:'key_admin', 'library-1', 'Bibliothèque', '', 60, null, '{"exercises":[{"block":"MAIN","name":"X"}]}', false);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000d","email":"share-d@share.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.coach_sessions where slug = 'library-1'), 'unshared: hidden again');
reset role;

\echo 'coach_sessions_shared.test.sql: all assertions passed'
