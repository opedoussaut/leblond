-- Past sessions, rescheduling and native route colours (self-contained).
\set ON_ERROR_STOP 1

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
  if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('d1000000-0000-0000-0000-000000000001', 'Edit Test Gym', 'CLIMBING_DISTRICT', 'CLIMBING_DISTRICT_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);
update public.sessions set ended_at = now() where ended_at is null;

-- A past bouldering session, created already finished.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('d2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-000000000001',
  '2026-09-10 16:00+00', '2026-09-10 17:30+00', 90);
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system)
values ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'BLUE', 'CLIMBING_DISTRICT_COLOR');
select public.log_attempt('d2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'ATTEMPT');
select public.log_attempt('d2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'TOP');
select pg_temp.expect((select bool_and(created_at between '2026-09-10 16:00+00' and '2026-09-10 17:30+00')
  from public.attempts where session_id = 'd2000000-0000-0000-0000-000000000001'),
  'attempts added to a past session are dated inside it');
select pg_temp.expect((select count(distinct created_at) = 2 from public.attempts where session_id = 'd2000000-0000-0000-0000-000000000001'),
  'attempts keep their order');

-- Reschedule: one day later, shorter. Attempts move with it and stay inside.
select public.reschedule_session('d2000000-0000-0000-0000-000000000001', '2026-09-11 08:00+00', 60);
select pg_temp.expect((select started_at = '2026-09-11 08:00+00' and ended_at = '2026-09-11 09:00+00' and duration_minutes = 60
  from public.sessions where id = 'd2000000-0000-0000-0000-000000000001'), 'session rescheduled');
select pg_temp.expect((select bool_and(created_at between '2026-09-11 08:00+00' and '2026-09-11 09:00+00')
  from public.attempts where session_id = 'd2000000-0000-0000-0000-000000000001'), 'attempts moved with the session');
select pg_temp.expect_error($$select public.reschedule_session('d2000000-0000-0000-0000-000000000001', now() + interval '1 day', 60)$$,
  'a session cannot be moved into the future');
select pg_temp.expect_error($$select public.reschedule_session('d2000000-0000-0000-0000-000000000001', '2026-09-11 08:00+00', 0)$$,
  'duration must be positive');

-- Live sessions keep "now" timestamps and cannot be rescheduled.
insert into public.sessions (id, user_id, gym_id) values
  ('d2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.reschedule_session('d2000000-0000-0000-0000-000000000002', '2026-09-01 08:00+00', 60)$$,
  'a live session cannot be rescheduled');
update public.sessions set ended_at = now() where id = 'd2000000-0000-0000-0000-000000000002';

-- Route sessions: attempts are refused; ascents keep the native colour + French grade.
insert into public.sessions (id, user_id, gym_id, discipline, started_at, ended_at, duration_minutes)
values ('d2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-000000000001',
  'ROUTE', '2026-09-12 16:00+00', '2026-09-12 18:00+00', 120);
select pg_temp.expect_error($$select public.log_attempt('d2000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000001', 'TOP')$$,
  'boulder attempts cannot go into a route session');
insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, native_grade, native_grade_system, created_at)
values ('00000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000003', gen_random_uuid(), '6a', 'AUTOBELAY', 'REDPOINT',
  'BLUE', 'CLIMBING_DISTRICT_COLOR', '2026-09-12 16:10+00');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, native_grade)
  values ('00000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-000000000003', gen_random_uuid(), '6a', 'LEAD', 'REDPOINT', 'BLUE')$$,
  'a native colour needs its grading system');
select public.reschedule_session('d2000000-0000-0000-0000-000000000003', '2026-09-13 16:00+00', 120);
select pg_temp.expect((select created_at = '2026-09-13 16:10+00' from public.route_ascents where session_id = 'd2000000-0000-0000-0000-000000000003'),
  'route ascents move with their session');

-- Another climber cannot reschedule or log into these sessions.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
select pg_temp.expect_error($$select public.reschedule_session('d2000000-0000-0000-0000-000000000001', '2026-09-01 08:00+00', 60)$$,
  'cannot reschedule another climber''s session');
select pg_temp.expect_error($$select public.log_attempt('d2000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'TOP')$$,
  'cannot log into another climber''s session');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select public.reschedule_session('d2000000-0000-0000-0000-000000000001', '2026-09-01 08:00+00', 60)$$,
  'anonymous visitors cannot call reschedule');
reset role;
select pg_temp.expect((select started_at = '2026-09-11 08:00+00' from public.sessions where id = 'd2000000-0000-0000-0000-000000000001'),
  'session unchanged by other users');

\echo 'session_editing.test.sql: all assertions passed'
