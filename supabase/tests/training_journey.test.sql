-- Training journey: daily check-ins are private, one per day, owner/day immutable;
-- a programme can only be linked to its own climber's assessment (self-contained).
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

-- Own climbers, so this file does not depend on the order test files run in.
insert into public.beta_users (email, display_name) values
  ('tj-a@journey.test', 'A'), ('tj-b@journey.test', 'B'), ('tj-off@journey.test', 'Off');
insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-00000000000a', 'tj-a@journey.test'),
  ('d1000000-0000-0000-0000-00000000000b', 'tj-b@journey.test'),
  ('d1000000-0000-0000-0000-00000000000c', 'tj-off@journey.test');

-- Legacy plans (written before the link existed) keep a null link.
insert into public.training_plans (id, user_id, name, weeks, sessions)
values ('d3000000-0000-0000-0000-0000000000b0', 'd1000000-0000-0000-0000-00000000000b', 'Plan de B', 4,
  '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]');
select pg_temp.expect((select assessment_id is null from public.training_plans where id = 'd3000000-0000-0000-0000-0000000000b0'),
  'existing plans have no assessment link');

-- ── Climber B: an assessment of their own ─────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-00000000000b","email":"tj-b@journey.test","role":"authenticated"}', false);
insert into public.training_assessments (id, user_id, method_id, ratings, horizon_weeks, sessions_per_week, kind, context)
values ('d2000000-0000-0000-0000-0000000000b1', 'd1000000-0000-0000-0000-00000000000b', 'technique',
  '{"technique":3,"fingers":3,"power":3,"endurance":3,"mental":3,"structure":3}', 8, 3, 'BASIC', '{}');

-- ── Climber A ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-00000000000a","email":"tj-a@journey.test","role":"authenticated"}', false);
insert into public.training_assessments (id, user_id, method_id, ratings, horizon_weeks, sessions_per_week, kind, context)
values ('d2000000-0000-0000-0000-0000000000a1', 'd1000000-0000-0000-0000-00000000000a', 'technique',
  '{"technique":3,"fingers":3,"power":3,"endurance":3,"mental":3,"structure":3}', 12, 4, 'BASIC',
  '{"injuries":[{"area":"shoulder","level":"DISCOMFORT"}]}');
insert into public.training_plans (id, user_id, name, weeks, sessions, assessment_id)
values ('d3000000-0000-0000-0000-0000000000a1', 'd1000000-0000-0000-0000-00000000000a', 'Programme', 12,
  '[{"day":1,"methodId":"technique","minutes":90,"notes":"","place":"BOULDER_GYM"}]', 'd2000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select assessment_id = 'd2000000-0000-0000-0000-0000000000a1' from public.training_plans
  where id = 'd3000000-0000-0000-0000-0000000000a1'), 'a programme is linked to its own assessment');

select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, assessment_id)
  values ('d1000000-0000-0000-0000-00000000000a', 'Stolen', 4, '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]',
  'd2000000-0000-0000-0000-0000000000b1')$$, 'cannot link a programme to another climber''s assessment');
select pg_temp.expect_error($$update public.training_plans set assessment_id = 'd2000000-0000-0000-0000-0000000000b1'
  where id = 'd3000000-0000-0000-0000-0000000000a1'$$, 'cannot re-link a programme to another climber''s assessment');

insert into public.training_day_checks (id, user_id, check_date, sleep, fatigue, soreness, pain, minutes_available, place,
  outcome, method_id, recommended_minutes, reasons, assessment_id)
values ('d4000000-0000-0000-0000-0000000000a1', 'd1000000-0000-0000-0000-00000000000a', '2026-11-10', 2, 2, 1,
  '[{"area":"shoulder","level":"DISCOMFORT"}]', 90, 'BOULDER_GYM', 'REDUCED', 'technique', 75,
  '["painAdapt:shoulder"]', 'd2000000-0000-0000-0000-0000000000a1');
select pg_temp.expect((select user_id = 'd1000000-0000-0000-0000-00000000000a' from public.training_day_checks
  where id = 'd4000000-0000-0000-0000-0000000000a1'), 'owner can record a daily check-in');

select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-10', 3, 1, 0, 60, 'HOME', 'AS_PLANNED')$$,
  'one daily check-in per day');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-11', 4, 1, 0, 60, 'HOME', 'AS_PLANNED')$$,
  'sleep is on a 3-point scale');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-11', 2, 1, 0, 60, 'BEACH', 'AS_PLANNED')$$,
  'unknown place rejected');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-11', 2, 1, 0, 60, 'HOME', 'PARTY')$$,
  'unknown outcome rejected');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness, pain,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-11', 2, 1, 0, '{"area":"knee"}', 60, 'HOME', 'REST')$$,
  'pain must be a list');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome, assessment_id) values ('d1000000-0000-0000-0000-00000000000a', '2026-11-11', 2, 1, 0, 60, 'HOME', 'REST',
  'd2000000-0000-0000-0000-0000000000b1')$$, 'cannot attach a check-in to another climber''s assessment');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000b', '2026-11-11', 2, 1, 0, 60, 'HOME', 'REST')$$,
  'cannot record a check-in for someone else');

-- Redoing the check-in updates the answers; owner, day and link stay put.
update public.training_day_checks set sleep = 1, outcome = 'TECHNIQUE', reasons = '["tired"]'
  where id = 'd4000000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select outcome = 'TECHNIQUE' and sleep = 1 from public.training_day_checks
  where id = 'd4000000-0000-0000-0000-0000000000a1'), 'owner can redo today''s check-in');
select pg_temp.expect_error($$update public.training_day_checks set user_id = 'd1000000-0000-0000-0000-00000000000b'
  where id = 'd4000000-0000-0000-0000-0000000000a1'$$, 'check-in owner is immutable');
select pg_temp.expect_error($$update public.training_day_checks set check_date = '2026-11-01'
  where id = 'd4000000-0000-0000-0000-0000000000a1'$$, 'check-in day is immutable');

-- ── Climber B cannot see or touch A's check-in ────────────────────────────
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-00000000000b","email":"tj-b@journey.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.training_day_checks) = 0, 'daily check-ins are private');
update public.training_day_checks set outcome = 'REST' where id = 'd4000000-0000-0000-0000-0000000000a1';
delete from public.training_day_checks where id = 'd4000000-0000-0000-0000-0000000000a1';

-- ── A deactivated tester loses access ─────────────────────────────────────
reset role;
update public.beta_users set active = false where email = 'tj-off@journey.test';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-0000-0000-00000000000c","email":"tj-off@journey.test","role":"authenticated"}', false);
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness,
  minutes_available, place, outcome) values ('d1000000-0000-0000-0000-00000000000c', '2026-11-10', 2, 1, 0, 60, 'HOME', 'REST')$$,
  'inactive tester cannot record check-ins');

-- ── Anonymous ─────────────────────────────────────────────────────────────
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.training_day_checks$$, 'anon cannot read daily check-ins');
reset role;

select pg_temp.expect((select outcome = 'TECHNIQUE' from public.training_day_checks where id = 'd4000000-0000-0000-0000-0000000000a1'),
  'other climbers cannot edit or delete a check-in');

-- Deleting an assessment keeps the programme and the check-ins, only the link is cleared.
delete from public.training_assessments where id = 'd2000000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select assessment_id is null from public.training_plans where id = 'd3000000-0000-0000-0000-0000000000a1')
  and (select assessment_id is null and user_id = 'd1000000-0000-0000-0000-00000000000a' from public.training_day_checks
    where id = 'd4000000-0000-0000-0000-0000000000a1'),
  'deleting an assessment unlinks, never deletes, the programme and check-ins');

\echo 'training_journey.test.sql: all assertions passed'
