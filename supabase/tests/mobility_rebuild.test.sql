-- Mobility Rebuild | 12 Weeks: the coach key assigns the programme to its owner only, never
-- backdated, without duplicates on a re-run; séances and check-ins are private (self-contained).
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

insert into public.beta_users (email, display_name) values ('reb-a@rebuild.test', 'A'), ('reb-b@rebuild.test', 'B');
insert into auth.users (id, email) values
  ('e1200000-0000-0000-0000-00000000000a', 'reb-a@rebuild.test'),
  ('e1200000-0000-0000-0000-00000000000b', 'reb-b@rebuild.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1200000-0000-0000-0000-00000000000a","email":"reb-a@rebuild.test","role":"authenticated"}', false);
select public.create_coach_key('Claude') as key_a \gset
reset role;

-- Dates relative to today (Paris), so the test never ages.
select ((now() at time zone 'Europe/Paris')::date)::text as today,
       ((now() at time zone 'Europe/Paris')::date + 2)::text as d1,
       ((now() at time zone 'Europe/Paris')::date + 4)::text as d2,
       ((now() at time zone 'Europe/Paris')::date + 7)::text as d3,
       ((now() at time zone 'Europe/Paris')::date + 9)::text as d4 \gset

create temp table s (n int, body jsonb);
grant select on s to anon, authenticated;
insert into s values
  (1, format('{"slot":1,"date":"%s","phase":1,"minutes":60,"title":"A · Hanches","exercises":[
      {"position":0,"block":"WARMUP","name":"Check-in","modality":"FREE","instructions":{"minutes":5}},
      {"position":1,"block":"MAIN","name":"Lever de pied","modality":"REPS","target_sets":2,"target_reps":6,"rest_seconds":60,"instructions":{"minutes":55,"alternative":"Assis"}}]}', :'d1')::jsonb),
  (2, format('{"slot":2,"date":"%s","phase":1,"minutes":60,"title":"B · Force","exercises":[{"position":0,"block":"MAIN","name":"Chaise","modality":"REPS","instructions":{}}]}', :'d2')::jsonb),
  (3, format('{"slot":3,"date":"%s","phase":1,"minutes":60,"title":"C · Grimpe","exercises":[{"position":0,"block":"MAIN","name":"Pieds","modality":"REPS","instructions":{}}]}', :'d3')::jsonb),
  (4, format('{"slot":4,"date":"%s","phase":1,"minutes":60,"title":"A · Hanches","exercises":[{"position":0,"block":"MAIN","name":"Lever","modality":"REPS","instructions":{}}]}', :'d4')::jsonb);

-- ── The key alone assigns, never in the past, never twice ────────────────
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_error(format($$select public.coach_key_assign_rebuild(%L, '{2,4,7}', '{"version":1}',
  jsonb_build_array(jsonb_set((select body from s where n = 1), '{date}', to_jsonb(%L::text))))$$, :'key_a', :'today'), 'a séance today is refused (never backdated)');
select pg_temp.expect_error(format($$select public.coach_key_assign_rebuild(%L, '{2,4,7}', '{"version":1}',
  jsonb_build_array(jsonb_set((select body from s where n = 1), '{date}', '"2020-01-07"')))$$, :'key_a'), 'a séance in the past is refused');
select pg_temp.expect_error(format($$select public.coach_key_assign_rebuild(%L, '{2,4}', '{"version":1}', (select jsonb_agg(body) from s where n <= 3))$$, :'key_a'), 'three days required');
select pg_temp.expect_error(format($$select public.coach_key_assign_rebuild(%L, '{2,4,7}', '{"version":1}', '[{"slot":1,"date":"2099-01-01","phase":1,"minutes":60,"title":"X","exercises":[]}]')$$, :'key_a'), 'a séance needs exercises');
select pg_temp.expect_error($$select public.coach_key_rebuild_status('lbk_000000000000000000000000000000000000000000000000')$$, 'unknown key');
select pg_temp.expect(public.coach_key_rebuild_status(:'key_a') is null, 'nothing assigned yet');

select public.coach_key_assign_rebuild(:'key_a', '{2,4,7}', '{"version":1,"templates":[]}', (select jsonb_agg(body order by n) from s where n <= 3)) as first \gset
select pg_temp.expect((:'first'::jsonb ->> 'created')::int = 3 and (:'first'::jsonb ->> 'sessions')::int = 3, 'three séances created');
select public.coach_key_assign_rebuild(:'key_a', '{2,4,7}', '{"version":1,"templates":[]}', (select jsonb_agg(body order by n) from s where n <= 3)) as again \gset
select pg_temp.expect((:'again'::jsonb ->> 'created')::int = 0 and (:'again'::jsonb ->> 'existing')::int = 3
  and (:'again'::jsonb ->> 'sessions')::int = 3, 're-running creates no duplicate');
select pg_temp.expect(:'again'::jsonb ->> 'enrollment_id' = :'first'::jsonb ->> 'enrollment_id', 'same enrolment');
select public.coach_key_assign_rebuild(:'key_a', '{2,4,7}', '{"version":1,"templates":[]}', (select jsonb_agg(body order by n) from s)) as more \gset
select pg_temp.expect((:'more'::jsonb ->> 'created')::int = 1 and (:'more'::jsonb ->> 'sessions')::int = 4, 'only the missing slot is added');
select public.coach_key_rebuild_status(:'key_a') as status \gset
select pg_temp.expect((:'status'::jsonb ->> 'sessions')::int = 4 and (:'status'::jsonb ->> 'slots')::int = 4
  and (:'status'::jsonb ->> 'exercises')::int = 5 and :'status'::jsonb ->> 'started_on' = :'d1'
  and (:'status'::jsonb -> 'by_status' ->> 'PLANNED')::int = 4, 'status counts the assignment');
select pg_temp.expect_error($$select count(*) from public.training_sessions$$, 'anon cannot read séances');
select pg_temp.expect_error($$select count(*) from public.mobility_session_checks$$, 'anon cannot read check-ins');
reset role;
select pg_temp.expect((select count(*) = 4 and bool_and(user_id = 'e1200000-0000-0000-0000-00000000000a' and method_id = 'mobility-rebuild'
  and status = 'PLANNED' and original_date = scheduled_date and scheduled_date > (now() at time zone 'Europe/Paris')::date)
  from public.training_sessions where enrollment_id is not null), 'written for the key owner only, all in the future');
select pg_temp.expect((select count(*) = 0 from public.training_sessions where user_id = 'e1200000-0000-0000-0000-00000000000b'), 'nothing written for B');
select id as sess_a from public.training_sessions where programme_slot = 1 \gset
select pg_temp.expect((select instructions ->> 'alternative' = 'Assis' and target_sets = 2 from public.training_session_exercises
  where session_id = :'sess_a' and position = 1), 'exercise rows keep sets, minutes and the alternative');

-- ── Climber A in the app ─────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1200000-0000-0000-0000-00000000000a","email":"reb-a@rebuild.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 4 from public.training_sessions where enrollment_id is not null), 'A sees their 4 séances');
insert into public.mobility_session_checks (user_id, session_id, moment, back_pain, leg_radiation, verdict, phase_used)
values ('e1200000-0000-0000-0000-00000000000a', :'sess_a', 'BEFORE', 3, 1, 'GO', 1);
select pg_temp.expect_error(format($$insert into public.mobility_session_checks (user_id, session_id, moment, back_pain, leg_radiation, verdict)
  values ('e1200000-0000-0000-0000-00000000000a', %L, 'BEFORE', 3, 1, 'GO')$$, :'sess_a'), 'one check-in per moment');
select pg_temp.expect_error(format($$insert into public.mobility_session_checks (user_id, session_id, moment)
  values ('e1200000-0000-0000-0000-00000000000a', %L, 'D1')$$, :'sess_a'), 'a next-day follow-up needs its overall answer');
select pg_temp.expect_error(format($$insert into public.mobility_session_checks (user_id, session_id, moment, verdict)
  values ('e1200000-0000-0000-0000-00000000000a', %L, 'AFTER', 'MAYBE')$$, :'sess_a'), 'unknown verdict');
update public.mobility_enrollments set clinical_review_on = '2026-12-15', clinical_restrictions = 'Pas de mur', schedule_days = '{1,3,5}'
  where programme = 'REBUILD_12W';
select pg_temp.expect((select clinical_review_on = '2026-12-15' from public.mobility_enrollments where programme = 'REBUILD_12W'), 'A records a review');
select pg_temp.expect_error($$update public.mobility_enrollments set content = '{}' where programme = 'REBUILD_12W'$$, 'the content is not editable in the app');
select pg_temp.expect_error($$update public.mobility_enrollments set started_on = '2020-01-01' where programme = 'REBUILD_12W'$$, 'the start is never rewritten');
select pg_temp.expect_error($$update public.training_sessions set programme_slot = 9 where programme_slot = 1$$, 'the slot is lineage');
select pg_temp.expect_error($$update public.training_sessions set enrollment_id = null where programme_slot = 1$$, 'the enrolment link is lineage');
reset role;

-- ── Climber B sees and touches nothing of A's ────────────────────────────
select id as enr_a from public.mobility_enrollments where user_id = 'e1200000-0000-0000-0000-00000000000a' and programme = 'REBUILD_12W' \gset
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1200000-0000-0000-0000-00000000000b","email":"reb-b@rebuild.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.training_sessions), 'B cannot read A''s séances');
select pg_temp.expect((select count(*) = 0 from public.mobility_enrollments), 'B cannot read A''s enrolment');
select pg_temp.expect((select count(*) = 0 from public.mobility_session_checks), 'B cannot read A''s check-ins');
select pg_temp.expect_error(format($$insert into public.mobility_session_checks (user_id, session_id, moment, verdict)
  values ('e1200000-0000-0000-0000-00000000000b', %L, 'AFTER', 'GO')$$, :'sess_a'), 'B cannot attach a check-in to A''s séance');
select pg_temp.expect_error(format($$insert into public.mobility_session_checks (user_id, session_id, moment, verdict)
  values ('e1200000-0000-0000-0000-00000000000a', %L, 'AFTER', 'GO')$$, :'sess_a'), 'B cannot write as A');
select pg_temp.expect_error(format($$insert into public.training_sessions (user_id, title, enrollment_id, programme_slot)
  values ('e1200000-0000-0000-0000-00000000000b', 'X', %L, 30)$$, :'enr_a'), 'B cannot add a séance to A''s programme');
update public.mobility_enrollments set clinical_review_on = '2020-01-01';
reset role;
select pg_temp.expect((select clinical_review_on = '2026-12-15' from public.mobility_enrollments where id = :'enr_a'), 'B''s update touched nothing');

\echo 'mobility_rebuild.test.sql: all assertions passed'
