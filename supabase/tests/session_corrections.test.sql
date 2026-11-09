-- Removing a boulder from a session, and several tries on one boulder in one go (self-contained).
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

-- Invited, so the file also passes with sign-up closed to the whitelist.
insert into public.beta_users (email, display_name) values
  ('fix-a@fix.test', 'Fix A'),
  ('fix-b@fix.test', 'Fix B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-00000000000a', 'fix-a@fix.test'),
  ('ad000000-0000-0000-0000-00000000000b', 'fix-b@fix.test');
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes) values
  ('ae000000-0000-0000-0000-000000000001', 'Fix Crag', 'OUTDOOR', 'FONT', true, false),
  ('ae000000-0000-0000-0000-000000000002', 'Fix Other Crag', 'OUTDOOR', 'FONT', true, false);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-00000000000a","email":"fix-a@fix.test","role":"authenticated"}', false);

-- Two finished sessions at the crag, and a boulder tried in both.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes) values
  ('af000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 'ae000000-0000-0000-0000-000000000001',
   '2026-10-01 09:00+00', '2026-10-01 12:00+00', 180),
  ('af000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-00000000000a', 'ae000000-0000-0000-0000-000000000001',
   '2026-10-08 09:00+00', '2026-10-08 12:00+00', 180);
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system) values
  ('af100000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', '6A', 'FONT'),
  ('af100000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', '5c', 'FONT'),
  ('af100000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-00000000000a', '5a', 'FONT');

-- ── log_problem_tries ──────────────────────────────────────────────────────
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000001', 3, 'ATTEMPT');
select pg_temp.expect((select count(*) = 3 and bool_and(result = 'ATTEMPT') and min(attempt_number) = 1 and max(attempt_number) = 3
    and bool_and(created_at between '2026-10-01 09:00+00' and '2026-10-01 12:00+00')
  from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000001'), 'three failed tries inside the past session');
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000001', 2, 'TOP');
select pg_temp.expect((select string_agg(result::text, ',' order by attempt_number) = 'ATTEMPT,ATTEMPT,ATTEMPT,ATTEMPT,TOP'
  from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000001'), 'numbering continues; the last try is the top');
select pg_temp.expect_error($$select public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000001', 1, 'FLASH')$$,
  'no flash on a boulder already tried');
select pg_temp.expect_error($$select public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000002', 2, 'FLASH')$$,
  'a flash is a single try');
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000002', 1, 'FLASH');
select pg_temp.expect((select attempt_number = 1 and result = 'FLASH' from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000002'),
  'a flash on a new boulder');
select pg_temp.expect_error($$select public.log_problem_tries('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000003', 1, 'TOP')$$,
  'a boulder from another site is refused');
select pg_temp.expect_error($$select public.log_problem_tries('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000002', 51, 'ATTEMPT')$$,
  'at most 50 tries at once');

-- A project: tries plus an active project, once.
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system)
values ('af100000-0000-0000-0000-000000000004', 'ae000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', '7A', 'FONT');
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000004', 4, 'PROJECT');
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000004', 1, 'PROJECT');
select pg_temp.expect((select count(*) = 5 and bool_and(result = 'ATTEMPT') from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000004')
  and (select count(*) = 1 from public.projects where problem_id = 'af100000-0000-0000-0000-000000000004' and status = 'ACTIVE'),
  'project tries are unsent and the project exists once');

-- ── remove_problem_from_session ────────────────────────────────────────────
-- Boulder 1 was tried in both sessions: removing it from the first keeps it, renumbered from 1.
select pg_temp.expect((select (public.remove_problem_from_session('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000001'))
  = '{"removed": 3, "problem_deleted": false}'::jsonb), 'three tries removed, boulder kept');
select pg_temp.expect((select string_agg(attempt_number || ':' || result, ',' order by attempt_number) = '1:ATTEMPT,2:TOP'
  from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000001'), 'remaining tries renumbered from 1');
-- Removing it from its last session deletes it.
select pg_temp.expect((select (public.remove_problem_from_session('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000001'))
  = '{"removed": 2, "problem_deleted": true}'::jsonb), 'nothing left: the boulder is deleted');
select pg_temp.expect((select count(*) = 0 from public.problems where id = 'af100000-0000-0000-0000-000000000001'), 'boulder gone');

-- A flash stays try 1 when a later session is removed.
select count(*) from public.log_problem_tries('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000002', 2, 'ATTEMPT');
select public.remove_problem_from_session('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000002');
select pg_temp.expect((select string_agg(attempt_number || ':' || result, ',' order by attempt_number) = '1:ATTEMPT,2:ATTEMPT'
  from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000002'), 'flash session removed: the other tries start at 1');

-- An active project stays (in Projets) even with no tries left.
select public.remove_problem_from_session('af000000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) = 1 from public.problems where id = 'af100000-0000-0000-0000-000000000004')
  and (select count(*) = 0 from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000004'), 'an active project is kept, without tries');

-- Other climbers can do neither.
select set_config('request.jwt.claims', '{"sub":"ad000000-0000-0000-0000-00000000000b","email":"fix-b@fix.test","role":"authenticated"}', false);
select pg_temp.expect_error($$select public.remove_problem_from_session('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000002')$$,
  'cannot remove from another climber''s session');
select pg_temp.expect_error($$select public.log_problem_tries('af000000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000002', 1, 'TOP')$$,
  'cannot log on another climber''s session');
reset role;
select pg_temp.expect((select count(*) = 2 from public.attempts where problem_id = 'af100000-0000-0000-0000-000000000002'),
  'the other climber changed nothing');
select pg_temp.expect(not has_function_privilege('anon', 'public.remove_problem_from_session(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.log_problem_tries(uuid, uuid, integer, text)', 'execute'),
  'anonymous visitors cannot call either');
\echo 'session_corrections.test.sql: all assertions passed'
