-- RLS and integrity assertions for executable training sessions.
-- Runs after rls.test.sql in the same database (users ...0a Olivier and ...0b Thomas exist).
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

-- Existing data written before this migration keeps working (additive change).
select pg_temp.expect((select count(*) from public.training_assessments where kind = 'SELF' and measurements = '[]'::jsonb) >= 1,
  'legacy assessments default to SELF with no measurements');

-- ── Olivier ────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);

insert into public.training_sessions (id, user_id, title, method_id, status, scheduled_date, planned_minutes)
values ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Max hangs', 'max-hangs', 'PLANNED', '2026-10-25', 60);
insert into public.training_session_exercises (id, user_id, session_id, position, block, name, modality, target_sets, target_seconds, rest_seconds, instructions)
values ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001',
  0, 'MAIN', 'Heavy hangs', 'HOLD', 5, 10, 180, '{"version":1,"key":"max-hang-sets"}');

select pg_temp.expect_error($$insert into public.training_sessions (user_id, title, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Bad', 'IN_PROGRESS')$$, 'a running session must have a start time');
select pg_temp.expect_error($$insert into public.training_sessions (user_id, title, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Bad', 'DONE')$$, 'unknown status rejected');

update public.training_sessions set status = 'IN_PROGRESS', started_at = now() where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$insert into public.training_sessions (user_id, title, status, started_at) values
  ('00000000-0000-0000-0000-00000000000a', 'Second live', 'IN_PROGRESS', now())$$, 'only one running training session per climber');

insert into public.training_exercise_sets (user_id, exercise_id, set_index, seconds, load_kg)
values ('00000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000001', 1, 10, 5);
select pg_temp.expect_error($$insert into public.training_exercise_sets (user_id, exercise_id, set_index, seconds)
  values ('00000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000001', 1, 9)$$,
  'a retried set cannot be duplicated');
update public.training_exercise_sets set seconds = 9 where exercise_id = 'a2000000-0000-0000-0000-000000000001' and set_index = 1;
select pg_temp.expect((select seconds from public.training_exercise_sets where exercise_id = 'a2000000-0000-0000-0000-000000000001') = 9,
  'owner can correct a set');

select pg_temp.expect_error($$update public.training_sessions set user_id = '00000000-0000-0000-0000-00000000000b'
  where id = 'a1000000-0000-0000-0000-000000000001'$$, 'session owner is immutable');
select pg_temp.expect_error($$update public.training_session_exercises set name = 'Rewritten'
  where id = 'a2000000-0000-0000-0000-000000000001'$$, 'instruction snapshot is not editable');
select pg_temp.expect_error($$update public.training_session_exercises set instructions = '{}'::jsonb
  where id = 'a2000000-0000-0000-0000-000000000001'$$, 'instruction snapshot JSON is not editable');

update public.training_sessions set status = 'COMPLETED', completed_at = now(), actual_minutes = 45, rpe = 8
  where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.expect((select status = 'COMPLETED' from public.training_sessions where id = 'a1000000-0000-0000-0000-000000000001'),
  'session completes');

-- Calendar entries can be linked once, and only to the owner's own entry.
select pg_temp.expect_error($$insert into public.training_sessions (user_id, title, calendar_entry_id) values
  ('00000000-0000-0000-0000-00000000000a', 'Not mine', '79999999-0000-0000-0000-000000000099')$$, 'cannot link a missing calendar entry');

-- ── Thomas ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.training_sessions) = 0, 'training sessions are private');
select pg_temp.expect((select count(*) from public.training_session_exercises) = 0, 'training exercises are private');
select pg_temp.expect((select count(*) from public.training_exercise_sets) = 0, 'training sets are private');
update public.training_sessions set title = 'Hijacked' where id = 'a1000000-0000-0000-0000-000000000001';
delete from public.training_exercise_sets where exercise_id = 'a2000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$insert into public.training_session_exercises (user_id, session_id, position, block, name, modality)
  values ('00000000-0000-0000-0000-00000000000b', 'a1000000-0000-0000-0000-000000000001', 5, 'MAIN', 'Injected', 'REPS')$$,
  'cannot attach exercises to another climber''s session');
select pg_temp.expect_error($$insert into public.training_exercise_sets (user_id, exercise_id, set_index, reps)
  values ('00000000-0000-0000-0000-00000000000b', 'a2000000-0000-0000-0000-000000000001', 2, 5)$$,
  'cannot log sets on another climber''s exercise');
select pg_temp.expect_error($$insert into public.training_sessions (user_id, title) values
  ('00000000-0000-0000-0000-00000000000a', 'Impersonation')$$, 'cannot create sessions for someone else');
select pg_temp.expect_error($$insert into public.training_sessions (user_id, title, plan_id) values
  ('00000000-0000-0000-0000-00000000000b', 'Steal plan', '50000000-0000-0000-0000-000000000001')$$, 'cannot reference another climber''s plan');

reset role;
select pg_temp.expect((select title from public.training_sessions where id = 'a1000000-0000-0000-0000-000000000001') = 'Max hangs',
  'other climbers cannot edit a session');
select pg_temp.expect((select count(*) from public.training_exercise_sets where exercise_id = 'a2000000-0000-0000-0000-000000000001') = 1,
  'other climbers cannot delete sets');

-- ── Anonymous ──────────────────────────────────────────────────────────────
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.training_sessions$$, 'anon cannot read training sessions');
select pg_temp.expect_error($$select count(*) from public.training_exercise_sets$$, 'anon cannot read training sets');
reset role;

-- Deleting a session cascades to its exercises and sets (no orphans).
delete from public.training_sessions where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) from public.training_session_exercises where session_id = 'a1000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.training_exercise_sets where exercise_id = 'a2000000-0000-0000-0000-000000000001') = 0,
  'cascade delete leaves no orphans');

\echo 'training-sessions.test.sql: all assertions passed'
