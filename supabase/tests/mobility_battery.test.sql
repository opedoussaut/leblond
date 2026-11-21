-- Mobility performance assessment (battery v2): bilans and results are private, "not done"
-- is never a zero, access levels hold in the database, finished bilans are locked
-- (self-contained).
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
  ('bat-a@battery.test', 'A'), ('bat-b@battery.test', 'B'), ('bat-off@battery.test', 'Off');
insert into auth.users (id, email) values
  ('b4700000-0000-0000-0000-00000000000a', 'bat-a@battery.test'),
  ('b4700000-0000-0000-0000-00000000000b', 'bat-b@battery.test'),
  ('b4700000-0000-0000-0000-00000000000c', 'bat-off@battery.test');

-- ── Climber A ─────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b4700000-0000-0000-0000-00000000000a","email":"bat-a@battery.test","role":"authenticated"}', false);

insert into public.mobility_battery_sessions (id, user_id, protocol_version, started_on, conditions, knee_pain_today)
values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 1, '2026-12-01',
  '{"chairHeightCm":45,"shoes":"BAREFOOT","warmUp":"WALK"}', true);
select pg_temp.expect((select status = 'IN_PROGRESS' and completed_at is null from public.mobility_battery_sessions), 'a new bilan is in progress');
select pg_temp.expect_error($$insert into public.mobility_battery_sessions (user_id, protocol_version, started_on)
  values ('b4700000-0000-0000-0000-00000000000a', 1, '2026-12-02')$$, 'only one bilan in progress at a time');
select pg_temp.expect_error($$insert into public.mobility_battery_sessions (user_id, protocol_version, started_on)
  values ('b4700000-0000-0000-0000-00000000000b', 1, '2026-12-02')$$, 'cannot start a bilan for someone else');
select pg_temp.expect_error($$insert into public.mobility_battery_sessions (user_id, protocol_version, started_on, status, stop_reason, completed_at)
  values ('b4700000-0000-0000-0000-00000000000a', 1, '2026-12-02', 'COMPLETED', null, now())$$, 'a bilan cannot be created already finished');
select pg_temp.expect_error($$update public.mobility_battery_sessions set d1_check = '{"backPain":2}'$$, 'no next-day check while in progress');

-- Raw values, left/right, trials.
insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, item, trial, status, value, unit, pain_before, pain_after, radiation)
values
  ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M01', 1, 'BOTH', 1, 1, 'DONE', 2, 'SCORE', null, null, 'NONE'),
  ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M03', 1, 'BOTH', 1, 1, 'DONE', 11.4, 'SECONDS', 2, 2, 'NONE'),
  ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M03', 1, 'BOTH', 1, 2, 'DONE', 10.9, 'SECONDS', 2, 3, 'NONE'),
  ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M07', 1, 'LEFT', 1, 1, 'DONE', 14, 'CM', 1, 1, 'NONE');
insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit, not_done_reason)
values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M07', 1, 'RIGHT', 'NOT_DONE', 'CM', 'PAIN');
select pg_temp.expect((select count(*) = 5 from public.mobility_battery_results), 'owner records results');
select pg_temp.expect((select value is null from public.mobility_battery_results where card_id = 'M07' and side = 'RIGHT'), 'not done keeps no value');

-- "Not done" is never a zero.
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit, not_done_reason)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'NOT_DONE', 0, 'CM', 'PAIN')$$, 'not done with a zero rejected');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'NOT_DONE', 'CM')$$, 'not done needs a reason');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'DONE', 'CM')$$, 'done needs a value');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit, not_done_reason)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'DONE', 3, 'CM', 'PAIN')$$, 'done has no not-done reason');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, trial, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 3, 'DONE', 3, 'CM')$$, 'two scored trials at most');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M21', 1, 'LEFT', 'DONE', 3, 'CM')$$, 'unknown card rejected');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit, pain_after)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'DONE', 3, 'CM', 11)$$, 'pain is 0–10');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M07', 1, 'LEFT', 'DONE', 15, 'CM')$$, 'one row per card, side, item and trial');

-- Access levels hold in the database.
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M05', 1, 'LEFT', 'DONE', 8, 'CM')$$, 'knee-to-wall refused on a knee-pain day');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M17', 1, 'LEFT', 'DONE', 20, 'CM')$$, 'climbing foot placement needs a clinical review');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M19', 1, 'LEFT', 'DONE', 100, 'DEGREES')$$, 'clinician card is not a self-test');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M07', 1, 'BOTH', 'DONE', 'REPORT')$$, 'only clinician cards are reports');
-- A locked card can still be recorded as not done, with the reason.
insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit, not_done_reason)
values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M17', 1, 'LEFT', 'NOT_DONE', 'CM', 'LOCKED');
-- After a self-declared clinical review, the card opens.
update public.mobility_battery_sessions set clinical_review_on = '2026-11-20', knee_pain_today = false;
insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M17', 1, 'RIGHT', 'DONE', 22, 'CM');
insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, unit, note)
values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M20', 1, 'BOTH', 'DONE', 'REPORT', 'Reported by the clinician');

-- Values can be corrected while the bilan is open; owner and card cannot.
update public.mobility_battery_results set value = 13 where card_id = 'M07' and side = 'LEFT';
select pg_temp.expect((select value = 13 from public.mobility_battery_results where card_id = 'M07' and side = 'LEFT'), 'value corrected during the bilan');
select pg_temp.expect_error($$update public.mobility_battery_results set card_id = 'M08'$$, 'card is never rewritten');
select pg_temp.expect_error($$update public.mobility_battery_results set user_id = 'b4700000-0000-0000-0000-00000000000b'$$, 'owner is never rewritten');
select pg_temp.expect_error($$update public.mobility_battery_sessions set started_on = '2026-01-01'$$, 'date is never rewritten');

-- Finish: the bilan is locked, except its next-day check and notes.
update public.mobility_battery_sessions set status = 'COMPLETED', completed_at = now();
update public.mobility_battery_results set value = 99 where card_id = 'M07' and side = 'LEFT';
select pg_temp.expect((select value = 13 from public.mobility_battery_results where card_id = 'M07' and side = 'LEFT'), 'results locked after completion');
delete from public.mobility_battery_results;
select pg_temp.expect((select count(*) = 8 from public.mobility_battery_results), 'results cannot be deleted after completion');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a1', 'b4700000-0000-0000-0000-00000000000a', 'M08', 1, 'LEFT', 'DONE', 3, 'CM')$$, 'no new result after completion');
select pg_temp.expect_error($$update public.mobility_battery_sessions set status = 'IN_PROGRESS', completed_at = null$$, 'a finished bilan never reopens');
select pg_temp.expect_error($$update public.mobility_battery_sessions set knee_pain_today = true$$, 'conditions locked after completion');
update public.mobility_battery_sessions set d1_check = '{"backPain":3,"legPain":1,"radiationLower":false}', notes = 'Same chair';
select pg_temp.expect((select d1_check->>'backPain' = '3' and notes = 'Same chair' from public.mobility_battery_sessions), 'next-day check and notes after completion');
select pg_temp.expect_error($$update public.mobility_battery_sessions set d1_check = '[1]'$$, 'next-day check is an object');

-- A stopped bilan needs its reason.
select pg_temp.expect_error($$insert into public.mobility_battery_sessions (user_id, protocol_version, started_on, status)
  values ('b4700000-0000-0000-0000-00000000000a', 1, '2026-12-29', 'STOPPED')$$, 'stopped is never created directly');
insert into public.mobility_battery_sessions (id, user_id, protocol_version, started_on)
values ('b4710000-0000-0000-0000-0000000000a2', 'b4700000-0000-0000-0000-00000000000a', 1, '2026-12-29');
select pg_temp.expect_error($$update public.mobility_battery_sessions set status = 'STOPPED', completed_at = now()
  where id = 'b4710000-0000-0000-0000-0000000000a2'$$, 'stopped needs a reason');
update public.mobility_battery_sessions set status = 'STOPPED', stop_reason = 'SYMPTOM', completed_at = now()
  where id = 'b4710000-0000-0000-0000-0000000000a2';

-- ── Climber B sees and changes none of it ─────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"b4700000-0000-0000-0000-00000000000b","email":"bat-b@battery.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.mobility_battery_sessions), 'B cannot read A''s bilans');
select pg_temp.expect((select count(*) = 0 from public.mobility_battery_results), 'B cannot read A''s results');
update public.mobility_battery_sessions set notes = 'hacked';
delete from public.mobility_battery_sessions;
-- B's own bilan cannot carry results into A's bilan.
insert into public.mobility_battery_sessions (id, user_id, protocol_version, started_on)
values ('b4710000-0000-0000-0000-0000000000b1', 'b4700000-0000-0000-0000-00000000000b', 1, '2026-12-01');
select pg_temp.expect_error($$insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, status, value, unit)
  values ('b4710000-0000-0000-0000-0000000000a2', 'b4700000-0000-0000-0000-00000000000b', 'M08', 1, 'LEFT', 'DONE', 3, 'CM')$$, 'B cannot write into A''s bilan');
reset role;
select pg_temp.expect((select count(*) = 2 from public.mobility_battery_sessions where user_id = 'b4700000-0000-0000-0000-00000000000a'), 'B could not delete A''s bilans');
select pg_temp.expect((select notes = 'Same chair' from public.mobility_battery_sessions where id = 'b4710000-0000-0000-0000-0000000000a1'), 'B could not change A''s notes');

-- ── A deactivated beta tester loses access to their own rows ─────────────
insert into public.mobility_battery_sessions (user_id, protocol_version, started_on)
values ('b4700000-0000-0000-0000-00000000000c', 1, '2026-12-01');
update public.beta_users set active = false where email = 'bat-off@battery.test';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b4700000-0000-0000-0000-00000000000c","email":"bat-off@battery.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.mobility_battery_sessions), 'inactive tester sees nothing');

-- ── Anonymous visitors get nothing ───────────────────────────────────────
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_error($$select count(*) from public.mobility_battery_sessions$$, 'anon cannot read bilans');
select pg_temp.expect_error($$select count(*) from public.mobility_battery_results$$, 'anon cannot read results');
reset role;

\echo 'mobility_battery.test.sql: all assertions passed'
