-- RLS and integrity assertions for the LEBLOND schema.
-- Run by scripts/test-db.sh on top of supabase-emulation.sql + migrations.
\set ON_ERROR_STOP 1

-- Helper: assert that a statement fails.
create or replace function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok (expected failure) %: [%] %', label, sqlstate, sqlerrm;
    return;
  end;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
end $$;

create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
end $$;

-- ── Setup as superuser ─────────────────────────────────────────────────────
insert into public.beta_users (email, display_name, role) values
  ('olivier@example.test', 'Olivier', 'admin'),
  ('thomas@example.test', 'Thomas', 'beta_tester'),
  ('inactive@example.test', 'Inactive', 'beta_tester');
update public.beta_users set active = false where email = 'inactive@example.test';

-- Whitelist: uninvited and deactivated emails cannot create an account.
select pg_temp.expect_error($$insert into auth.users (email) values ('stranger@example.test')$$, 'uninvited signup');
select pg_temp.expect_error($$insert into auth.users (email) values ('inactive@example.test')$$, 'inactive signup');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'olivier@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'Thomas@Example.test');

select pg_temp.expect((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Olivier', 'profile auto-created with beta display name');
select pg_temp.expect((select count(*) from public.profiles) = 2, 'two profiles');

grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

-- ── Olivier ────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);

insert into public.gyms (id, name, brand, city, country, grading_system)
  values ('10000000-0000-0000-0000-000000000001', 'Arkose Test', 'ARKOSE', 'Paris', 'FR', 'ARKOSE_COLOR');
insert into public.gyms (id, name, brand, city, country, grading_system)
  values ('10000000-0000-0000-0000-000000000002', 'Climbing District Test', 'CLIMBING_DISTRICT', 'Paris', 'FR', 'CLIMBING_DISTRICT_COLOR');
select pg_temp.expect_error($$insert into public.gyms (name, brand, grading_system) values ('Bad Arkose', 'ARKOSE', 'FONT')$$, 'Arkose must use Arkose colours');

insert into public.problems (id, gym_id, native_grade, native_grade_system)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'RED', 'ARKOSE_COLOR');
insert into public.problems (id, gym_id, native_grade, native_grade_system)
  values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'BLUE', 'ARKOSE_COLOR');
insert into public.problems (id, gym_id, native_grade, native_grade_system, normalized_grade, normalized_grade_system, normalization_confidence, normalization_source)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'PINK', 'CLIMBING_DISTRICT_COLOR', '6C', 'FONT', 0.6, 'USER_ESTIMATE');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system) values ('10000000-0000-0000-0000-000000000001', 'PINK', 'ARKOSE_COLOR')$$, 'PINK is not an Arkose grade');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system) values ('10000000-0000-0000-0000-000000000001', 'BLUE', 'CLIMBING_DISTRICT_COLOR')$$, 'problem system must match gym');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system, normalized_grade, normalized_grade_system) values ('10000000-0000-0000-0000-000000000001', 'RED', 'ARKOSE_COLOR', '6C', 'FONT')$$, 'estimate without confidence/source rejected');

insert into public.sessions (id, gym_id) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$insert into public.sessions (gym_id) values ('10000000-0000-0000-0000-000000000001')$$, 'only one active session');

select public.log_attempt('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ATTEMPT');
select public.log_attempt('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'TOP');
select public.log_attempt('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'FLASH');
select pg_temp.expect_error($$select public.log_attempt('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'FLASH')$$, 'FLASH after first attempt rejected');
select pg_temp.expect((select max(attempt_number) from public.attempts where problem_id = '20000000-0000-0000-0000-000000000001') = 2, 'attempt numbers increment');

-- Correcting a classification is allowed; changing identity columns is not.
update public.attempts set result = 'FLASH' where problem_id = '20000000-0000-0000-0000-000000000002';
select pg_temp.expect_error($$update public.attempts set result = 'FLASH' where problem_id = '20000000-0000-0000-0000-000000000001' and attempt_number = 2$$, 'cannot reclassify attempt 2 as FLASH');
select pg_temp.expect_error($$update public.attempts set attempt_number = 9$$, 'attempt_number is not updatable');

insert into public.wearable_activities (id, provider, provider_activity_id, started_at, duration_seconds, avg_heart_rate, dedup_key)
  values ('40000000-0000-0000-0000-000000000001', 'FIT_IMPORT', 'fit-1', now(), 5400, 120, 'k1');
select public.link_wearable_activity('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');
select pg_temp.expect((select wearable_activity_id from public.sessions where id = '30000000-0000-0000-0000-000000000001') = '40000000-0000-0000-0000-000000000001', 'activity linked both ways');

select public.unlink_wearable_activity('40000000-0000-0000-0000-000000000001');
select pg_temp.expect((select wearable_activity_id from public.sessions where id = '30000000-0000-0000-0000-000000000001') is null, 'activity unlinked both ways');
select public.link_wearable_activity('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001');

insert into public.ai_usage (model, request_type) values ('test-model', 'chat');
select pg_temp.expect_error($$delete from public.ai_usage$$, 'ai_usage is append-only');

select pg_temp.expect((select count(*) from public.beta_users) = 3, 'admin sees the roster');
select pg_temp.expect((select count(*) from public.admin_beta_overview()) = 3, 'admin overview works');

insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-00000000000a/p/photo.jpg');

reset role;

-- Server (service role) stores an encrypted connection for Olivier.
insert into public.wearable_connections (user_id, provider, status, access_token_encrypted)
  values ('00000000-0000-0000-0000-00000000000a', 'SUUNTO', 'CONNECTED', 'v1:ciphertext');

-- ── Thomas: must not see any of Olivier's private data ─────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);

select pg_temp.expect((select count(*) from public.gyms) = 2, 'gym catalogue is shared');
select pg_temp.expect((select count(*) from public.problems) = 0, 'problems are private');
select pg_temp.expect((select count(*) from public.sessions) = 0, 'sessions are private');
select pg_temp.expect((select count(*) from public.attempts) = 0, 'attempts are private');
select pg_temp.expect((select count(*) from public.wearable_activities) = 0, 'wearable activities are private');
select pg_temp.expect((select count(*) from public.profiles) = 1, 'only own profile');
select pg_temp.expect((select count(*) from public.ai_usage) = 0, 'ai usage is private');
select pg_temp.expect((select count(*) from public.beta_users) = 1, 'tester only sees own whitelist row');
select pg_temp.expect((select count(*) from public.wearable_connections) = 0, 'connections are private');
select pg_temp.expect((select count(*) from storage.objects) = 0, 'storage objects are private');

select pg_temp.expect_error($$select public.log_attempt('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'TOP')$$, 'cannot log on someone else''s session');
select pg_temp.expect_error($$insert into public.attempts (session_id, problem_id, attempt_number, result) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 5, 'TOP')$$, 'cannot insert attempts into someone else''s session');
select pg_temp.expect_error($$select public.admin_beta_overview()$$, 'tester cannot use admin overview');
select pg_temp.expect_error($$select access_token_encrypted from public.wearable_connections$$, 'token columns are not readable');
select pg_temp.expect_error($$insert into public.wearable_connections (user_id, provider, status) values ('00000000-0000-0000-0000-00000000000b', 'GARMIN', 'CONNECTED')$$, 'client cannot fake a connection');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-00000000000a/evil.jpg')$$, 'cannot write into another user''s folder');
select pg_temp.expect_error($$insert into public.beta_users (email, display_name) values ('friend@example.test', 'Friend')$$, 'cannot self-invite');

update public.gyms set name = 'Hijacked' where id = '10000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.expect((select name from public.gyms where id = '10000000-0000-0000-0000-000000000001') = 'Arkose Test', 'cannot edit a gym created by someone else');

-- ── Anonymous ──────────────────────────────────────────────────────────────
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.gyms$$, 'anon cannot read gyms');
select pg_temp.expect_error($$select count(*) from public.beta_users$$, 'anon cannot read whitelist');
reset role;

\echo 'rls.test.sql: all assertions passed'
