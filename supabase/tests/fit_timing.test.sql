-- Watch (FIT) timing applied to climbing sessions (self-contained).
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
  ('fit-a@fit.test', 'Fit A'),
  ('fit-b@fit.test', 'Fit B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('f3000000-0000-0000-0000-00000000000a', 'fit-a@fit.test'),
  ('f3000000-0000-0000-0000-00000000000b', 'fit-b@fit.test');
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('e5000000-0000-0000-0000-000000000001', 'FIT Test Gym', 'ARKOSE', 'ARKOSE_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3000000-0000-0000-0000-00000000000a","email":"fit-a@fit.test","role":"authenticated"}', false);

-- 1. A session entered afterwards (synthetic attempt times), wrong day: the watch is right.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('e6000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-000000000001',
  '2026-09-20 16:00+00', '2026-09-20 18:00+00', 120);
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system)
values ('e7000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-00000000000a', 'BLUE', 'ARKOSE_COLOR');
select public.log_attempt('e6000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001', 'ATTEMPT');
select public.log_attempt('e6000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001', 'TOP');

insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key)
values ('e8000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:1', '2026-09-21 09:00:27+00', 5400, 'k1');
select pg_temp.expect_error($$select public.apply_activity_timing('e6000000-0000-0000-0000-000000000001')$$,
  'no linked activity, nothing to apply');
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001');
select pg_temp.expect((select timing_source = 'MANUAL' and started_at = '2026-09-20 16:00+00' from public.sessions
  where id = 'e6000000-0000-0000-0000-000000000001'), 'linking alone does not touch the times');

select public.apply_activity_timing('e6000000-0000-0000-0000-000000000001');
select pg_temp.expect((select timing_source = 'ACTIVITY' and started_at = '2026-09-21 09:00:27+00'
    and ended_at = '2026-09-21 10:30:27+00' and duration_minutes = 90
  from public.sessions where id = 'e6000000-0000-0000-0000-000000000001'), 'watch start and duration applied');
select pg_temp.expect((select bool_and(created_at between '2026-09-21 09:00:27+00' and '2026-09-21 10:30:27+00') and count(distinct created_at) = 2
  from public.attempts where session_id = 'e6000000-0000-0000-0000-000000000001'), 'attempts moved into the new window, order kept');
select pg_temp.expect((select count(*) = 2 from public.attempts where session_id = 'e6000000-0000-0000-0000-000000000001'),
  'no attempt duplicated');

-- Saving the edit form with the same minute and duration keeps the exact watch time.
select public.reschedule_session('e6000000-0000-0000-0000-000000000001', '2026-09-21 09:00+00', 90);
select pg_temp.expect((select timing_source = 'ACTIVITY' and started_at = '2026-09-21 09:00:27+00'
  from public.sessions where id = 'e6000000-0000-0000-0000-000000000001'), 'unchanged save keeps the watch timing');
-- A real change makes the times manual again.
select public.reschedule_session('e6000000-0000-0000-0000-000000000001', '2026-09-21 09:15+00', 90);
select pg_temp.expect((select timing_source = 'MANUAL' and started_at = '2026-09-21 09:15+00'
  from public.sessions where id = 'e6000000-0000-0000-0000-000000000001'), 'manual reschedule marks the times manual');
select public.apply_activity_timing('e6000000-0000-0000-0000-000000000001');
update public.sessions set duration_minutes = 80, ended_at = started_at + interval '80 minutes'
  where id = 'e6000000-0000-0000-0000-000000000001';
select pg_temp.expect((select timing_source = 'MANUAL' from public.sessions where id = 'e6000000-0000-0000-0000-000000000001'),
  'a direct edit of the times marks them manual');

-- One activity per session: a second one replaces the first.
insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key)
values ('e8000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-00000000000a', 'GARMIN', 'g-2', '2026-09-21 09:01+00', 5300, 'k2');
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000002', 'e6000000-0000-0000-0000-000000000001');
select pg_temp.expect((select session_id is null from public.wearable_activities where id = 'e8000000-0000-0000-0000-000000000001'),
  'the previous activity is detached');
select pg_temp.expect((select count(*) = 1 from public.wearable_activities where session_id = 'e6000000-0000-0000-0000-000000000001'),
  'a session has at most one activity');
select public.apply_activity_timing('e6000000-0000-0000-0000-000000000001');
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000002', null);
select pg_temp.expect((select timing_source = 'MANUAL' and wearable_activity_id is null and started_at = '2026-09-21 09:01+00'
  from public.sessions where id = 'e6000000-0000-0000-0000-000000000001'), 'unlinking keeps the times, now as manual ones');

-- Route sessions: ascents move with the session too.
insert into public.sessions (id, user_id, gym_id, discipline, started_at, ended_at, duration_minutes)
values ('e6000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-000000000001',
  'ROUTE', '2026-09-24 08:00+00', '2026-09-24 10:00+00', 120);
insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, tries)
values ('f3000000-0000-0000-0000-00000000000a', 'e6000000-0000-0000-0000-000000000004', gen_random_uuid(), '6a', 'LEAD', 'REDPOINT', 2);
insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key)
values ('e8000000-0000-0000-0000-000000000005', 'f3000000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:5', '2026-09-24 14:00+00', 3600, 'k5');
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000005', 'e6000000-0000-0000-0000-000000000004');
select public.apply_activity_timing('e6000000-0000-0000-0000-000000000004');
select pg_temp.expect((select count(*) = 1 and bool_and(created_at between '2026-09-24 14:00+00' and '2026-09-24 15:00+00')
  from public.route_ascents where session_id = 'e6000000-0000-0000-0000-000000000004'), 'route ascents move with the session too');

-- 2. A session logged live: attempts carry real times and stay where they are.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('e6000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-000000000001',
  '2026-09-22 16:05+00', '2026-09-22 17:50+00', 105);
select public.log_attempt('e6000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000001', 'TOP');
reset role;
update public.attempts set created_at = '2026-09-22 16:40+00' where session_id = 'e6000000-0000-0000-0000-000000000002';
insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key)
values ('e8000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:3', '2026-09-22 16:00+00', 7200, 'k3'),
       ('e8000000-0000-0000-0000-000000000004', 'f3000000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:4', '2026-09-23 16:00+00', 20, 'k4');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3000000-0000-0000-0000-00000000000a","email":"fit-a@fit.test","role":"authenticated"}', false);
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000003', 'e6000000-0000-0000-0000-000000000002');
select public.apply_activity_timing('e6000000-0000-0000-0000-000000000002');
select pg_temp.expect((select created_at = '2026-09-22 16:40+00' from public.attempts where session_id = 'e6000000-0000-0000-0000-000000000002'),
  'live attempt times are kept when they already fit');

-- 3. Refusals: a 20-second recording has no usable timing; live sessions; other climbers.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('e6000000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-00000000000a', 'e5000000-0000-0000-0000-000000000001',
  '2026-09-23 16:00+00', '2026-09-23 17:00+00', 60);
select public.link_wearable_activity('e8000000-0000-0000-0000-000000000004', 'e6000000-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.apply_activity_timing('e6000000-0000-0000-0000-000000000003')$$,
  'an activity without a usable duration is refused');
update public.sessions set ended_at = null, duration_minutes = null where id = 'e6000000-0000-0000-0000-000000000003';
select pg_temp.expect_error($$select public.apply_activity_timing('e6000000-0000-0000-0000-000000000003')$$,
  'a live session keeps its live times');

select set_config('request.jwt.claims', '{"sub":"f3000000-0000-0000-0000-00000000000b","email":"fit-b@fit.test","role":"authenticated"}', false);
select pg_temp.expect_error($$select public.apply_activity_timing('e6000000-0000-0000-0000-000000000002')$$,
  'cannot apply timing to another climber''s session');
select pg_temp.expect_error($$select public.link_wearable_activity('e8000000-0000-0000-0000-000000000003', null)$$,
  'cannot unlink another climber''s activity');
reset role;
update public.sessions set ended_at = now() where id = 'e6000000-0000-0000-0000-000000000003';
\echo 'fit_timing.test.sql: all assertions passed'
