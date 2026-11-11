-- Mobility programme: enrolments and assessments are private, owner/programme/results
-- are never rewritten, set details are bounded (self-contained).
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

insert into public.beta_users (email, display_name) values
  ('mob-a@mobility.test', 'A'), ('mob-b@mobility.test', 'B'), ('mob-off@mobility.test', 'Off');
insert into auth.users (id, email) values
  ('e7000000-0000-0000-0000-00000000000a', 'mob-a@mobility.test'),
  ('e7000000-0000-0000-0000-00000000000b', 'mob-b@mobility.test'),
  ('e7000000-0000-0000-0000-00000000000c', 'mob-off@mobility.test');

-- ── Climber A ─────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-0000-0000-00000000000a","email":"mob-a@mobility.test","role":"authenticated"}', false);
insert into public.mobility_enrollments (id, user_id, programme, started_on)
values ('e7100000-0000-0000-0000-0000000000a1', 'e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-18');
select pg_temp.expect((select working_level = 0 and status = 'ACTIVE' and session_length = 'STANDARD' and sessions_per_week = 3
  from public.mobility_enrollments where id = 'e7100000-0000-0000-0000-0000000000a1'), 'a new enrolment starts at level 0');
select pg_temp.expect_error($$insert into public.mobility_enrollments (user_id, programme, started_on)
  values ('e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-19')$$, 'one enrolment per programme');
select pg_temp.expect_error($$insert into public.mobility_enrollments (user_id, programme, started_on)
  values ('e7000000-0000-0000-0000-00000000000a', 'SPLITS', '2026-11-19')$$, 'unknown programme rejected');
select pg_temp.expect_error($$insert into public.mobility_enrollments (user_id, programme, started_on)
  values ('e7000000-0000-0000-0000-00000000000b', 'HIP', '2026-11-19')$$, 'cannot enrol someone else');

-- The climber changes their own working level, within 0–4.
update public.mobility_enrollments set working_level = 1, level_changed_at = now(), session_length = 'SHORT'
  where id = 'e7100000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select working_level = 1 and session_length = 'SHORT' from public.mobility_enrollments), 'level changed by the climber');
select pg_temp.expect_error($$update public.mobility_enrollments set working_level = 5$$, 'level above 4 rejected');
select pg_temp.expect_error($$update public.mobility_enrollments set sessions_per_week = 0$$, 'at least one session a week');
select pg_temp.expect_error($$update public.mobility_enrollments set started_on = '2026-01-01'$$, 'start date is never rewritten');
select pg_temp.expect_error($$update public.mobility_enrollments set user_id = 'e7000000-0000-0000-0000-00000000000b'$$, 'owner is never rewritten');

insert into public.mobility_assessments (id, user_id, programme, assessed_on, protocol_version, conditions, results, stage, rules_version)
values ('e7200000-0000-0000-0000-0000000000a1', 'e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-18', 1,
  '{"warmedUp":true,"timeOfDay":"EVENING"}',
  '[{"test":"A","side":"BOTH","level":1,"support":"HANDS","discomfort":2,"active":true}]', 0, 1);
select pg_temp.expect((select count(*) = 1 from public.mobility_assessments), 'owner records an assessment');
select pg_temp.expect_error($$insert into public.mobility_assessments (user_id, programme, assessed_on, protocol_version, results, stage, rules_version)
  values ('e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-19', 1, '[]', 0, 1)$$, 'an assessment needs results');
select pg_temp.expect_error($$insert into public.mobility_assessments (user_id, programme, assessed_on, protocol_version, results, stage, rules_version)
  values ('e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-19', 1, '{"test":"A"}', 0, 1)$$, 'results must be a list');
select pg_temp.expect_error($$insert into public.mobility_assessments (user_id, programme, assessed_on, protocol_version, results, stage, rules_version)
  values ('e7000000-0000-0000-0000-00000000000a', 'HIP', '2026-11-19', 1, '[{"test":"A"}]', 5, 1)$$, 'stage is 0–4');
select pg_temp.expect_error($$insert into public.mobility_assessments (user_id, programme, assessed_on, protocol_version, results, stage, rules_version)
  values ('e7000000-0000-0000-0000-00000000000b', 'HIP', '2026-11-19', 1, '[{"test":"A"}]', 0, 1)$$, 'cannot record for someone else');
update public.mobility_assessments set notes = 'Cushion under the hip' where id = 'e7200000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select notes = 'Cushion under the hip' from public.mobility_assessments), 'notes can be corrected');
select pg_temp.expect_error($$update public.mobility_assessments set stage = 4$$, 'the stage is never edited');
select pg_temp.expect_error($$update public.mobility_assessments set results = '[{"test":"A","level":4}]'$$, 'results are never edited');

-- Mobility set details on A's own session.
insert into public.training_sessions (id, user_id, title, method_id) values
  ('e7300000-0000-0000-0000-0000000000a1', 'e7000000-0000-0000-0000-00000000000a', 'Hip mobility', 'hip-mobility');
insert into public.training_session_exercises (id, user_id, session_id, position, block, name, modality)
values ('e7400000-0000-0000-0000-0000000000a1', 'e7000000-0000-0000-0000-00000000000a', 'e7300000-0000-0000-0000-0000000000a1', 0, 'MAIN', 'Rotations', 'REPS');
insert into public.training_exercise_sets (user_id, exercise_id, set_index, reps, side, variant, controlled, discomfort, details)
values ('e7000000-0000-0000-0000-00000000000a', 'e7400000-0000-0000-0000-0000000000a1', 1, 6, 'LEFT', 'EASIER', true, 2, '{"flags":[]}');
update public.training_exercise_sets set side = 'RIGHT', variant = 'STANDARD', controlled = false, discomfort = 3, details = '{"flags":["CATCHING"]}'
  where exercise_id = 'e7400000-0000-0000-0000-0000000000a1';
select pg_temp.expect((select side = 'RIGHT' and variant = 'STANDARD' and not controlled and discomfort = 3
  from public.training_exercise_sets where exercise_id = 'e7400000-0000-0000-0000-0000000000a1'), 'mobility set details corrected');
select pg_temp.expect_error($$update public.training_exercise_sets set side = 'UP'$$, 'unknown side rejected');
select pg_temp.expect_error($$update public.training_exercise_sets set variant = 'EXTREME'$$, 'unknown variant rejected');
select pg_temp.expect_error($$update public.training_exercise_sets set discomfort = 11$$, 'discomfort is 0–10');
select pg_temp.expect_error($$update public.training_exercise_sets set details = '["CATCHING"]'$$, 'details must be an object');
insert into public.training_exercise_sets (user_id, exercise_id, set_index, reps)
values ('e7000000-0000-0000-0000-00000000000a', 'e7400000-0000-0000-0000-0000000000a1', 2, 8);
select pg_temp.expect((select side is null and variant is null and controlled is null and discomfort is null and details is null
  from public.training_exercise_sets where set_index = 2), 'ordinary sets need none of the mobility details');

-- 'hip' joined the body areas: a daily check-in may list eight areas.
insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness, pain, minutes_available, place, outcome)
values ('e7000000-0000-0000-0000-00000000000a', '2026-11-18', 2, 2, 1,
  '[{"area":"fingers","level":"DISCOMFORT"},{"area":"wrist","level":"DISCOMFORT"},{"area":"elbow","level":"DISCOMFORT"},
    {"area":"shoulder","level":"DISCOMFORT"},{"area":"back","level":"DISCOMFORT"},{"area":"knee","level":"DISCOMFORT"},
    {"area":"hip","level":"DISCOMFORT"},{"area":"other","level":"DISCOMFORT"}]', 30, 'HOME', 'MOBILITY');
select pg_temp.expect((select jsonb_array_length(pain) = 8 from public.training_day_checks where check_date = '2026-11-18'), 'eight areas accepted');
select pg_temp.expect_error($$insert into public.training_day_checks (user_id, check_date, sleep, fatigue, soreness, pain, minutes_available, place, outcome)
  values ('e7000000-0000-0000-0000-00000000000a', '2026-11-19', 2, 2, 1, '[1,2,3,4,5,6,7,8,9]', 30, 'HOME', 'REST')$$, 'nine entries rejected');

-- ── Climber B sees and changes none of it ─────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-0000-0000-00000000000b","email":"mob-b@mobility.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.mobility_enrollments), 'B cannot read A''s enrolment');
select pg_temp.expect((select count(*) = 0 from public.mobility_assessments), 'B cannot read A''s assessments');
select pg_temp.expect((select count(*) = 0 from public.training_exercise_sets), 'B cannot read A''s sets');
update public.mobility_enrollments set working_level = 4;
delete from public.mobility_assessments;
reset role;
select pg_temp.expect((select working_level = 1 from public.mobility_enrollments where id = 'e7100000-0000-0000-0000-0000000000a1'), 'B could not change A''s level');
select pg_temp.expect((select count(*) = 1 from public.mobility_assessments where user_id = 'e7000000-0000-0000-0000-00000000000a'), 'B could not delete A''s assessment');

-- ── A deactivated beta tester loses access to their own rows ─────────────
insert into public.mobility_enrollments (user_id, programme, started_on)
values ('e7000000-0000-0000-0000-00000000000c', 'HIP', '2026-11-18');
update public.beta_users set active = false where email = 'mob-off@mobility.test';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7000000-0000-0000-0000-00000000000c","email":"mob-off@mobility.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.mobility_enrollments), 'inactive tester sees nothing');
select pg_temp.expect_error($$insert into public.mobility_assessments (user_id, programme, assessed_on, protocol_version, results, stage, rules_version)
  values ('e7000000-0000-0000-0000-00000000000c', 'HIP', '2026-11-19', 1, '[{"test":"A"}]', 0, 1)$$, 'inactive tester cannot record');

-- ── Anonymous visitors get nothing ───────────────────────────────────────
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_error($$select count(*) from public.mobility_enrollments$$, 'anon cannot read enrolments');
select pg_temp.expect_error($$select count(*) from public.mobility_assessments$$, 'anon cannot read assessments');
reset role;

\echo 'mobility.test.sql: all assertions passed'
