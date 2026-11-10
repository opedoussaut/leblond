-- Edge size on a training set: bounded, and the climber can correct it.
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
grant execute on function pg_temp.expect_error(text, text) to authenticated;
grant execute on function pg_temp.expect(boolean, text) to authenticated;

insert into public.beta_users (email, display_name) values ('edge@edge.test', 'E');
insert into auth.users (id, email) values ('fb000000-0000-0000-0000-00000000000e', 'edge@edge.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000e","email":"edge@edge.test","role":"authenticated"}', false);
insert into public.training_sessions (id, user_id, title) values ('eb000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-00000000000e', 'No-hang');
insert into public.training_session_exercises (id, user_id, session_id, position, block, name, modality)
values ('eb000000-0000-0000-0000-000000000002', 'fb000000-0000-0000-0000-00000000000e', 'eb000000-0000-0000-0000-000000000001', 0, 'MAIN', 'No-hang', 'HOLD');
insert into public.training_exercise_sets (user_id, exercise_id, set_index, seconds, load_kg, edge_mm)
values ('fb000000-0000-0000-0000-00000000000e', 'eb000000-0000-0000-0000-000000000002', 1, 10, 8, 12);
update public.training_exercise_sets set edge_mm = 20 where exercise_id = 'eb000000-0000-0000-0000-000000000002';
select pg_temp.expect((select edge_mm = 20 from public.training_exercise_sets where exercise_id = 'eb000000-0000-0000-0000-000000000002'), 'edge corrected');
select pg_temp.expect_error($$update public.training_exercise_sets set edge_mm = 2$$, 'edge too small');
select pg_temp.expect_error($$update public.training_exercise_sets set edge_mm = 61$$, 'edge too large');
reset role;

\echo 'set_edge.test.sql: all assertions passed'
